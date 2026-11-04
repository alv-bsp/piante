import { sb } from "./supabase.js";
import { stato, aggiorna } from "./stato.js";
import { caricaFoto, rimuoviFoto } from "./foto.js";

const CAMPI_PIANTA = "id, nome, tipo, stanza, vaso, substrato, giorni_estate, giorni_inverno, irrigazione_automatica, note, foto, miniatura, archiviata_il, creata_il, modificata_il";
const CAMPI_CICLO = "id, pianta_id, prodotto, ogni_giorni, dal_mese, al_mese, con_acqua, note, creato_il";
const CAMPI_CURA = "id, pianta_id, tipo, ciclo_id, prodotto, il";

/** Cicli raggruppati per pianta, in ordine di mese di inizio. */
function perPianta(cicli) {
  const m = new Map();
  for (const c of cicli) m.set(c.pianta_id, [...(m.get(c.pianta_id) || []), c]);
  for (const elenco of m.values()) elenco.sort((a, b) => a.dal_mese - b.dal_mese || a.prodotto.localeCompare(b.prodotto, "it"));
  return m;
}

/**
 * Carica tutto quello che serve dopo il login: piante, ultime cure, cicli di concime e ora del promemoria.
 * Qualche decina di righe: sta tutto in memoria. Lo storico completo di una pianta si legge solo nella sua scheda.
 */
export async function caricaTutto() {
  aggiorna({ caricamento: true, errore: null });
  const [piante, ultime, cicli, concimazioni, promemoria] = await Promise.all([
    sb.from("piante").select(CAMPI_PIANTA).order("nome"),
    sb.from("ultime_cure").select("pianta_id, ultima_bagnata, ultimo_controllo"),
    sb.from("cicli_concime").select(CAMPI_CICLO),
    sb.from("ultime_concimazioni").select("ciclo_id, ultima"),
    sb.from("promemoria").select("ora").maybeSingle(),
  ]);
  const risposte = [piante, ultime, cicli, concimazioni, promemoria];
  const primoErrore = risposte.find((r) => r.error)?.error;
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
    cicli: cicli.error ? stato.cicli : perPianta(cicli.data),
    ultimeConcime: concimazioni.error ? stato.ultimeConcime : new Map(concimazioni.data.map((u) => [u.ciclo_id, u.ultima])),
    ora: promemoria.data?.ora ?? stato.ora,
  });
}

// ───────────────────────────── piante

/**
 * Salva una pianta nuova o modificata, con i suoi cicli di concime. Se c'è una foto nuova la carica prima, e
 * cancella la vecchia solo dopo che il salvataggio è andato a buon fine. Per una nuova, `ultimaVolta` (AAAA-MM-GG)
 * registra l'ultima annaffiatura.
 */
export async function salvaPianta(bozza) {
  const nuova = !bozza.id;
  const id = bozza.id || crypto.randomUUID();
  const precedente = nuova ? null : stato.piante.find((p) => p.id === id);

  let percorsi = { foto: precedente?.foto ?? null, miniatura: precedente?.miniatura ?? null };
  const fotoNuova = Boolean(bozza.foto?.grande);
  if (fotoNuova) percorsi = await caricaFoto(stato.sessione.user.id, id, bozza.foto);
  else if (bozza.fotoRimossa) percorsi = { foto: null, miniatura: null };

  const riga = {
    nome: bozza.nome.trim(),
    tipo: bozza.tipo.trim() || null,
    stanza: bozza.stanza.trim(),
    vaso: bozza.vaso.trim() || null,
    substrato: bozza.substrato,
    giorni_estate: bozza.giorni_estate,
    giorni_inverno: bozza.giorni_inverno,
    irrigazione_automatica: bozza.irrigazione_automatica,
    note: bozza.note.trim() || null,
    ...percorsi,
  };
  const { data, error } = nuova
    ? await sb.from("piante").insert({ id, ...riga }).select(CAMPI_PIANTA).single()
    : await sb.from("piante").update(riga).eq("id", id).select(CAMPI_PIANTA).single();
  if (error) {
    if (fotoNuova) await rimuoviFoto([percorsi.foto, percorsi.miniatura]);
    throw error;
  }

  if (precedente && (fotoNuova || bozza.fotoRimossa)) rimuoviFoto([precedente.foto, precedente.miniatura]);
  aggiorna({ piante: nuova ? [...stato.piante, data] : stato.piante.map((p) => (p.id === data.id ? data : p)) });
  await salvaCicli(data.id, bozza.cicli);
  if (nuova && bozza.ultimaVolta && !bozza.irrigazione_automatica) await registraCura(data, "bagnata", mezzogiorno(bozza.ultimaVolta));
  return data;
}

const rigaCiclo = (c) => ({
  prodotto: c.prodotto.trim(),
  ogni_giorni: c.ogni_giorni,
  dal_mese: c.dal_mese,
  al_mese: c.al_mese,
  con_acqua: Boolean(c.con_acqua),
  note: c.note?.trim() || null,
});

/** Allinea i cicli di una pianta alla bozza: toglie quelli spariti, aggiorna i cambiati, aggiunge i nuovi. */
async function salvaCicli(piantaId, cicli) {
  const prima = stato.cicli.get(piantaId) || [];
  const tenuti = cicli.filter((c) => c.id);
  const via = prima.filter((c) => !tenuti.some((t) => t.id === c.id)).map((c) => c.id);
  const cambiati = tenuti.filter((t) => {
    const p = prima.find((c) => c.id === t.id);
    return p && JSON.stringify(rigaCiclo(p)) !== JSON.stringify(rigaCiclo(t));
  });
  const nuovi = cicli.filter((c) => !c.id).map((c) => ({ ...rigaCiclo(c), pianta_id: piantaId }));

  if (via.length) {
    const { error } = await sb.from("cicli_concime").delete().in("id", via);
    if (error) throw error;
  }
  for (const c of cambiati) {
    const { error } = await sb.from("cicli_concime").update(rigaCiclo(c)).eq("id", c.id);
    if (error) throw error;
  }
  if (nuovi.length) {
    const { error } = await sb.from("cicli_concime").insert(nuovi);
    if (error) throw error;
  }
  if (via.length || cambiati.length || nuovi.length) {
    const { data, error } = await sb.from("cicli_concime").select(CAMPI_CICLO).eq("pianta_id", piantaId);
    if (error) throw error;
    const mappa = new Map(stato.cicli);
    mappa.set(piantaId, perPianta(data).get(piantaId) || []);
    aggiorna({ cicli: mappa });
  }
}

/** Aggiunge in un colpo le piante di partenza (vedi partenza.js), con i loro cicli di concime. */
export async function aggiungiPiante(elenco) {
  const conId = elenco.map(({ cicli = [], ...p }) => ({ riga: { id: crypto.randomUUID(), ...p }, cicli }));
  const { data, error } = await sb.from("piante").insert(conId.map((x) => x.riga)).select(CAMPI_PIANTA);
  if (error) throw error;
  aggiorna({ piante: [...stato.piante, ...data] });

  const righeCicli = conId.flatMap((x) => x.cicli.map((c) => ({ ...rigaCiclo(c), pianta_id: x.riga.id })));
  if (righeCicli.length) {
    const r = await sb.from("cicli_concime").insert(righeCicli).select(CAMPI_CICLO);
    if (r.error) throw r.error; // le piante restano: i cicli si possono aggiungere da Modifica
    const mappa = new Map(stato.cicli);
    for (const [id, cicli] of perPianta(r.data)) mappa.set(id, cicli);
    aggiorna({ cicli: mappa });
  }
  return data;
}

/** Foto al volo dalla scheda: carica la foto già preparata, aggiorna la pianta, poi cancella quella vecchia. */
export async function impostaFoto(pianta, foto) {
  const percorsi = await caricaFoto(stato.sessione.user.id, pianta.id, foto);
  const { data, error } = await sb.from("piante").update(percorsi).eq("id", pianta.id).select(CAMPI_PIANTA).single();
  if (error) {
    await rimuoviFoto([percorsi.foto, percorsi.miniatura]);
    throw error;
  }
  rimuoviFoto([pianta.foto, pianta.miniatura]);
  aggiorna({ piante: stato.piante.map((p) => (p.id === data.id ? data : p)) });
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

/** Elimina per sempre la pianta, il suo storico e i suoi cicli, poi le sue foto. */
export async function eliminaPianta(pianta) {
  const { error } = await sb.from("piante").delete().eq("id", pianta.id);
  if (error) throw error;
  const ultime = new Map(stato.ultime);
  ultime.delete(pianta.id);
  const cicli = new Map(stato.cicli);
  cicli.delete(pianta.id);
  aggiorna({ piante: stato.piante.filter((p) => p.id !== pianta.id), ultime, cicli });
  rimuoviFoto([pianta.foto, pianta.miniatura]);
}

// ───────────────────────────── cure

/** Registra una o più cure in un colpo. Restituisce le righe salvate, per poterle annullare. */
export async function registraCure(righe) {
  const { data, error } = await sb.from("cure").insert(righe).select(CAMPI_CURA);
  if (error) throw error;
  const ultime = new Map(stato.ultime);
  const ultimeConcime = new Map(stato.ultimeConcime);
  const storico = new Map(stato.storico);
  for (const c of data) {
    if (c.tipo === "concimata") {
      const prima = ultimeConcime.get(c.ciclo_id);
      if (c.ciclo_id && (!prima || ms(c.il) > ms(prima))) ultimeConcime.set(c.ciclo_id, c.il);
    } else {
      const prima = ultime.get(c.pianta_id) || { pianta_id: c.pianta_id, ultima_bagnata: null, ultimo_controllo: null };
      const campo = c.tipo === "bagnata" ? "ultima_bagnata" : "ultimo_controllo";
      if (!prima[campo] || ms(c.il) > ms(prima[campo])) ultime.set(c.pianta_id, { ...prima, [campo]: c.il });
    }
    if (storico.has(c.pianta_id)) storico.set(c.pianta_id, [c, ...storico.get(c.pianta_id)].sort((a, b) => ms(b.il) - ms(a.il)));
  }
  aggiorna({ ultime, ultimeConcime, storico });
  return data;
}

/** Segna "bagnata" o "controllata" (ancora umida) per una pianta. Restituisce le righe, per annullarle. */
export const registraCura = (pianta, tipo, il = new Date().toISOString()) =>
  registraCure([{ pianta_id: pianta.id, tipo, il }]);

/** Concime dato. Con `conAcqua` segna anche l'annaffiatura, allo stesso istante. */
export function registraConcime(pianta, cicli, { conAcqua = false, il = new Date().toISOString() } = {}) {
  const righe = cicli.map((c) => ({ pianta_id: pianta.id, tipo: "concimata", ciclo_id: c.id, prodotto: c.prodotto, il }));
  if (conAcqua) righe.push({ pianta_id: pianta.id, tipo: "bagnata", il });
  return registraCure(righe);
}

/** Cancella delle cure (annulla, o voce sbagliata nello storico) e rilegge gli ultimi stati di piante e cicli toccati. */
export async function annullaCure(cure) {
  const { error } = await sb.from("cure").delete().in("id", cure.map((c) => c.id));
  if (error) throw error;
  const piante = [...new Set(cure.map((c) => c.pianta_id))];
  const cicli = [...new Set(cure.map((c) => c.ciclo_id).filter(Boolean))];
  const [u, uc] = await Promise.all([
    sb.from("ultime_cure").select("pianta_id, ultima_bagnata, ultimo_controllo").in("pianta_id", piante),
    cicli.length ? sb.from("ultime_concimazioni").select("ciclo_id, ultima").in("ciclo_id", cicli) : { data: [], error: null },
  ]);
  const ultime = new Map(stato.ultime);
  if (!u.error) {
    for (const id of piante) ultime.delete(id);
    for (const r of u.data) ultime.set(r.pianta_id, r);
  }
  const ultimeConcime = new Map(stato.ultimeConcime);
  if (!uc.error) {
    for (const id of cicli) ultimeConcime.delete(id);
    for (const r of uc.data) ultimeConcime.set(r.ciclo_id, r.ultima);
  }
  const tolte = new Set(cure.map((c) => c.id));
  const storico = new Map(stato.storico);
  for (const id of piante) if (storico.has(id)) storico.set(id, storico.get(id).filter((c) => !tolte.has(c.id)));
  aggiorna({ ultime, ultimeConcime, storico });
}

/** Ultime 40 cure di una pianta, per la scheda. */
export async function caricaStorico(piantaId) {
  const { data, error } = await sb
    .from("cure")
    .select(CAMPI_CURA)
    .eq("pianta_id", piantaId)
    .order("il", { ascending: false })
    .limit(40);
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
