import { sb } from "./supabase.js";
import { stato, aggiorna } from "./stato.js";

const CAMPI_PIANTA = "id, nome, tipo, stanza, vaso, substrato, giorni_estate, giorni_inverno, note, archiviata_il, creata_il, modificata_il";

/**
 * Carica tutto quello che serve dopo il login: piante, ultime cure e ora del promemoria.
 * Qualche decina di righe: sta tutto in memoria. Lo storico completo di una pianta si legge solo nella sua scheda.
 */
export async function caricaTutto() {
  aggiorna({ caricamento: true, errore: null });
  const [piante, ultime, promemoria] = await Promise.all([
    sb.from("piante").select(CAMPI_PIANTA).order("nome"),
    sb.from("ultime_cure").select("pianta_id, ultima_bagnata, ultimo_controllo"),
    sb.from("promemoria").select("ora").maybeSingle(),
  ]);
  const primoErrore = [piante, ultime, promemoria].find((r) => r.error)?.error;
  if (primoErrore) console.error("caricamento", primoErrore);

  let errore = null;
  if (primoErrore) {
    errore = senzaRete(primoErrore)
      ? "Nessuna connessione: non riesco a caricare i dati."
      : "Non riesco a leggere i dati. Hai eseguito supabase/schema.sql nel progetto Supabase?";
  }

  aggiorna({
    caricamento: false,
    errore,
    piante: piante.error ? stato.piante : piante.data,
    ultime: ultime.error ? stato.ultime : new Map(ultime.data.map((u) => [u.pianta_id, u])),
    ora: promemoria.data?.ora ?? stato.ora,
  });
}

// ───────────────────────────── piante

/** Salva una pianta nuova o modificata. Per una nuova, `ultimaVolta` (AAAA-MM-GG) registra l'ultima annaffiatura. */
export async function salvaPianta(bozza) {
  const riga = {
    nome: bozza.nome.trim(),
    tipo: bozza.tipo.trim() || null,
    stanza: bozza.stanza.trim(),
    vaso: bozza.vaso.trim() || null,
    substrato: bozza.substrato,
    giorni_estate: bozza.giorni_estate,
    giorni_inverno: bozza.giorni_inverno,
    note: bozza.note.trim() || null,
  };
  const nuova = !bozza.id;
  const { data, error } = nuova
    ? await sb.from("piante").insert(riga).select(CAMPI_PIANTA).single()
    : await sb.from("piante").update(riga).eq("id", bozza.id).select(CAMPI_PIANTA).single();
  if (error) throw error;

  aggiorna({ piante: nuova ? [...stato.piante, data] : stato.piante.map((p) => (p.id === data.id ? data : p)) });
  if (nuova && bozza.ultimaVolta) await registraCura(data, "bagnata", mezzogiorno(bozza.ultimaVolta));
  return data;
}

/** Aggiunge in un colpo le piante di partenza (vedi partenza.js). */
export async function aggiungiPiante(righe) {
  const { data, error } = await sb.from("piante").insert(righe).select(CAMPI_PIANTA);
  if (error) throw error;
  aggiorna({ piante: [...stato.piante, ...data] });
  return data;
}

/** Togli (archivia) o rimetti una pianta. Lo storico resta. */
export async function archiviaPianta(pianta, archiviata) {
  const { data, error } = await sb
    .from("piante")
    .update({ archiviata_il: archiviata ? new Date().toISOString() : null })
    .eq("id", pianta.id)
    .select(CAMPI_PIANTA)
    .single();
  if (error) throw error;
  aggiorna({ piante: stato.piante.map((p) => (p.id === data.id ? data : p)) });
}

/** Elimina per sempre la pianta e il suo storico. */
export async function eliminaPianta(pianta) {
  const { error } = await sb.from("piante").delete().eq("id", pianta.id);
  if (error) throw error;
  const ultime = new Map(stato.ultime);
  ultime.delete(pianta.id);
  aggiorna({ piante: stato.piante.filter((p) => p.id !== pianta.id), ultime });
}

// ───────────────────────────── cure

/** Segna "bagnata" o "controllata" (ancora umida). Restituisce la riga, per poterla annullare. */
export async function registraCura(pianta, tipo, il = new Date().toISOString()) {
  const { data, error } = await sb.from("cure").insert({ pianta_id: pianta.id, tipo, il }).select("id, pianta_id, tipo, il").single();
  if (error) throw error;
  const prima = stato.ultime.get(pianta.id) || { pianta_id: pianta.id, ultima_bagnata: null, ultimo_controllo: null };
  const campo = tipo === "bagnata" ? "ultima_bagnata" : "ultimo_controllo";
  const dopo = { ...prima, [campo]: !prima[campo] || ms(data.il) > ms(prima[campo]) ? data.il : prima[campo] };
  const storico = new Map(stato.storico);
  if (storico.has(pianta.id)) storico.set(pianta.id, [data, ...storico.get(pianta.id)].sort((a, b) => ms(b.il) - ms(a.il)));
  aggiorna({ ultime: new Map(stato.ultime).set(pianta.id, dopo), storico });
  return data;
}

/** Cancella una cura (annulla, o voce sbagliata nello storico) e rilegge l'ultima della pianta. */
export async function annullaCura(cura) {
  const { error } = await sb.from("cure").delete().eq("id", cura.id);
  if (error) throw error;
  const { data } = await sb.from("ultime_cure").select("pianta_id, ultima_bagnata, ultimo_controllo").eq("pianta_id", cura.pianta_id).maybeSingle();
  const ultime = new Map(stato.ultime);
  if (data) ultime.set(cura.pianta_id, data);
  else ultime.delete(cura.pianta_id);
  const storico = new Map(stato.storico);
  if (storico.has(cura.pianta_id)) storico.set(cura.pianta_id, storico.get(cura.pianta_id).filter((c) => c.id !== cura.id));
  aggiorna({ ultime, storico });
}

/** Ultime 30 cure di una pianta, per la scheda. */
export async function caricaStorico(piantaId) {
  const { data, error } = await sb
    .from("cure")
    .select("id, pianta_id, tipo, il")
    .eq("pianta_id", piantaId)
    .order("il", { ascending: false })
    .limit(30);
  if (error) throw error;
  aggiorna({ storico: new Map(stato.storico).set(piantaId, data) });
}

// ───────────────────────────── promemoria

export async function salvaOra(ora) {
  const { error } = await sb.from("promemoria").upsert({ user_id: stato.sessione.user.id, ora }, { onConflict: "user_id" });
  if (error) throw error;
  aggiorna({ ora });
}

/** Mezzogiorno del giorno scelto, ora locale: lontano dalla mezzanotte, il giorno resta quello anche a Roma. */
export const mezzogiorno = (giorno) => new Date(`${giorno}T12:00:00`).toISOString();

const ms = (iso) => new Date(iso).getTime();
const senzaRete = (e) => !navigator.onLine || /fetch|network/i.test(e?.message || "");
