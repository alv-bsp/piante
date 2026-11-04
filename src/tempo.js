import { FUSO, giornoRoma, giorniTra } from "../supabase/functions/_shared/scadenze.js";

// Date in parole, per gli elenchi e la scheda.

const fmtGiorno = new Intl.DateTimeFormat("it-IT", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
const fmtLungo = new Intl.DateTimeFormat("it-IT", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
const fmtOra = new Intl.DateTimeFormat("it-IT", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" });

const comeData = (giorno) => new Date(`${giorno}T12:00:00Z`);

/** "lun 3 nov" */
export const giornoBreve = (giorno) => fmtGiorno.format(comeData(giorno)).replace(/\./g, "");

/** "mercoledì 4 novembre" */
export const giornoLungo = (giorno) => fmtLungo.format(comeData(giorno));

/** "oggi", "ieri", "3 giorni fa" per un giorno passato rispetto a oggi. */
export function quanto(giorno, oggi = giornoRoma()) {
  const n = giorniTra(giorno, oggi);
  if (n <= 0) return "oggi";
  if (n === 1) return "ieri";
  return `${n} giorni fa`;
}

/** "domani", "tra 3 giorni", oppure per le scadute "da oggi", "da ieri", "da 3 giorni". */
export function traQuanto(mancano) {
  if (mancano > 1) return `tra ${mancano} giorni`;
  if (mancano === 1) return "domani";
  if (mancano === 0) return "da oggi";
  if (mancano === -1) return "da ieri";
  return `da ${-mancano} giorni`;
}

/** "oggi alle 19:30", "ieri alle 08:10", "lun 3 nov alle 19:30" per un istante ISO. */
export function quando(iso, oggi = giornoRoma()) {
  const giorno = giornoRoma(iso);
  const n = giorniTra(giorno, oggi);
  const prefisso = n === 0 ? "oggi" : n === 1 ? "ieri" : giornoBreve(giorno);
  return `${prefisso} alle ${fmtOra.format(new Date(iso))}`;
}
