// Routing a hash: su GitHub Pages non serve nessun ripiego lato server.
//   #/oggi · #/casa                            le due sezioni della tab bar
//   #/nuova                                    aggiunta di una pianta
//   #/pianta/<id> · #/pianta/<id>/modifica     scheda e modifica di una pianta
export const SEZIONI = ["oggi", "casa"];
const PAGINE = [...SEZIONI, "nuova", "pianta"];

export function rotta() {
  const [nome = "", ...param] = location.hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
  const valida = PAGINE.includes(nome) && (nome !== "pianta" || Boolean(param[0]));
  const n = valida ? nome : "oggi";
  return { nome: n, param, valida, sezione: SEZIONI.includes(n) ? n : "casa" };
}

/** Corregge un hash sconosciuto senza aggiungere una voce alla cronologia. */
export function normalizza() {
  if (!rotta().valida) history.replaceState(null, "", "#/oggi");
}

/** Va a una pagina sostituendo quella corrente (dopo un salvataggio, Indietro non riporta al form). */
export const sostituisci = (percorso) => location.replace(`#/${percorso}`);
export const vai = (percorso) => { location.hash = `#/${percorso}`; };
