import { giornoRoma, statoPianta, inOrdineDiScadenza } from "../supabase/functions/_shared/scadenze.js";

// Stato dell'app in memoria. Chi deve ridisegnare si iscrive con ascolta().
const ascoltatori = new Set();

export const stato = {
  pronto: false,        // sessione verificata all'avvio
  sessione: null,       // sessione Supabase, null se non c'è login
  caricamento: false,   // dati in arrivo
  errore: null,         // messaggio da mostrare in alto, se i dati non arrivano
  piante: null,         // tutte le piante, anche quelle tolte (archiviata_il), null finché non arrivano
  ultime: new Map(),    // pianta_id → { ultima_bagnata, ultimo_controllo }
  storico: new Map(),   // pianta_id → ultime cure, caricate quando apri la scheda
  ora: 9,               // ora del promemoria (Roma)
  notifiche: "verifico", // verifico · attive · spente · bloccate · serve-home · non-supportate · da-configurare
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
  aggiorna({ piante: null, ultime: new Map(), storico: new Map(), errore: null, caricamento: false, ora: 9 });

export const trovaPianta = (id) => stato.piante?.find((p) => p.id === id) || null;
export const attive = () => (stato.piante || []).filter((p) => !p.archiviata_il);
export const tolte = () => (stato.piante || []).filter((p) => p.archiviata_il);

export const statoDi = (p) => statoPianta(p, stato.ultime.get(p.id), stato.oggi);

/** Piante attive con stato, dalla più urgente. */
export const inOrdine = () => inOrdineDiScadenza(stato.piante || [], stato.ultime, stato.oggi);
export const scadute = () => inOrdine().filter((x) => x.stato.daControllare);

/** Stanze in uso, in ordine alfabetico. */
export const stanze = () =>
  [...new Set(attive().map((p) => p.stanza))].sort((a, b) => a.localeCompare(b, "it"));

export const tipi = () =>
  [...new Set((stato.piante || []).map((p) => p.tipo).filter(Boolean))].sort((a, b) => a.localeCompare(b, "it"));
