import {
  giornoRoma, statoPianta, statoCiclo, inOrdineDiScadenza, daFareOggi, quantePiante, conLAcqua,
} from "../supabase/functions/_shared/scadenze.js";

// Stato dell'app in memoria. Chi deve ridisegnare si iscrive con ascolta().
const ascoltatori = new Set();

export const stato = {
  pronto: false,          // sessione verificata all'avvio
  sessione: null,         // sessione Supabase, null se non c'è login
  caricamento: false,     // dati in arrivo
  errore: null,           // messaggio da mostrare in alto, se i dati non arrivano
  piante: null,           // tutte le piante, anche quelle tolte (archiviata_il), null finché non arrivano
  ultime: new Map(),      // pianta_id → { ultima_bagnata, ultimo_controllo }
  cicli: new Map(),       // pianta_id → [cicli di concime]
  ultimeConcime: new Map(), // ciclo_id → istante dell'ultima concimazione
  storico: new Map(),     // pianta_id → ultime cure, caricate quando apri la scheda
  cureRecenti: [],        // cure degli ultimi due mesi di tutte le piante, per il calendario
  diario: new Map(),      // pianta_id → foto del diario di crescita, caricate quando apri la scheda
  specieMie: [],          // specie aggiunte da te: { id, nome, concime } (tabella specie_mie)
  specieMieOk: true,      // false se la tabella non c'è ancora (migrazione da eseguire)
  ora: 9,                 // ora del promemoria (Roma)
  notifiche: "verifico",  // verifico · attive · spente · bloccate · serve-home · non-supportate · da-configurare
  oggi: giornoRoma(),
};

export function aggiorna(modifiche) {
  Object.assign(stato, modifiche, { oggi: giornoRoma() });
  for (const f of ascoltatori) f(stato);
}

export function ascolta(f) {
  ascoltatori.add(f);
  return () => ascoltatori.delete(f);
}

export const azzeraDati = () =>
  aggiorna({
    piante: null, ultime: new Map(), cicli: new Map(), ultimeConcime: new Map(), storico: new Map(),
    cureRecenti: [], diario: new Map(), specieMie: [], specieMieOk: true,
    errore: null, caricamento: false, ora: 9,
  });

export const trovaPianta = (id) => stato.piante?.find((p) => p.id === id) || null;
export const attive = () => (stato.piante || []).filter((p) => !p.archiviata_il);
export const tolte = () => (stato.piante || []).filter((p) => p.archiviata_il);

export const statoDi = (p) => statoPianta(p, stato.ultime.get(p.id), stato.oggi);

/** Piante attive con stato, dalla più urgente. */
export const inOrdine = () => inOrdineDiScadenza(stato.piante || [], stato.ultime, stato.oggi);

/** Piante da controllare (con il concime da sciogliere nell'acqua) e concimi da dare a parte. */
export const oggiDaFare = () => daFareOggi(stato.piante || [], stato.ultime, stato.cicli, stato.ultimeConcime, stato.oggi);
export const quanteDaFare = () => quantePiante(oggiDaFare());

/** Cicli di concime di una pianta, con il loro stato. */
export const cicliDi = (p) =>
  (stato.cicli.get(p.id) || []).map((ciclo) => ({ ciclo, stato: statoCiclo(ciclo, stato.ultimeConcime.get(ciclo.id), stato.oggi) }));

/** Concimi scaduti da sciogliere nella prossima annaffiatura. */
export const concimeInAcqua = (p) => cicliDi(p).filter((x) => x.stato.daFare && conLAcqua(x.ciclo, p)).map((x) => x.ciclo);

/** Stanze in uso, in ordine alfabetico. */
export const stanze = () =>
  [...new Set(attive().map((p) => p.stanza))].sort((a, b) => a.localeCompare(b, "it"));

export const tipi = () =>
  [...new Set((stato.piante || []).map((p) => p.tipo).filter(Boolean))].sort((a, b) => a.localeCompare(b, "it"));

/** Prodotti già usati nei cicli, per i suggerimenti dell'editor. */
export const prodotti = () =>
  [...new Set([...stato.cicli.values()].flat().map((c) => c.prodotto))].sort((a, b) => a.localeCompare(b, "it"));
