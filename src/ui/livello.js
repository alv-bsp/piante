import { raw } from "./html.js";

// Il cerchio del pulsante che si riempie d'acqua: pieno il giorno in cui bagni, vuoto quando è ora di controllare.
// Va dentro un .icona-btn, sotto l'icona: un'onda che scorre piano, ritagliata sul cerchio (viewBox 100×100).

// L'onda: mezze onde larghe 25, da x=-100 a x=100, così scorrendo di 50 (un periodo) copre sempre il cerchio.
const onda = (y) => `M-100 ${y}q12.5 -7 25 0${" t25 0".repeat(7)}V110H-100Z`;

const tra0e1 = (x) => Math.min(1, Math.max(0, x));
const CIMA = -4;        // pieno: il pelo dell'acqua sta un po' sopra il cerchio, le onde non lasciano scoperto niente
const ALTEZZA = 108;    // da pieno a vuoto (a vuoto anche le creste stanno sotto il fondo)
let progressivo = 0;

/**
 * `livello` da 0 (vuoto) a 1 (pieno). `da`: livello di prima, se è appena salito (hai bagnato): l'acqua sale da lì.
 * Gli id di clipPath e gradiente sono unici per pulsante, perché nella pagina ce ne sono tanti.
 */
export function livelloAcqua(livello, { da = null } = {}) {
  const l = tra0e1(livello);
  const vuoto = (x) => ((1 - tra0e1(x)) * ALTEZZA).toFixed(1);
  const id = `livello-${++progressivo}`;
  const sale = da != null && l > da;
  const stile = `--vuoto:${vuoto(l)};--pieno:${ALTEZZA}${sale ? `;--da:${vuoto(da)}` : ""}`;
  return raw(`
    <svg class="livello${sale ? " sale" : ""}" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false" style="${stile}">
      <defs>
        <clipPath id="${id}"><circle cx="50" cy="50" r="50"/></clipPath>
        <linearGradient id="${id}-acqua" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#38bdf8"/><stop offset="1" stop-color="#0369a1"/>
        </linearGradient>
      </defs>
      <g clip-path="url(#${id})">
        <g class="livello-acqua"><path class="livello-onda" d="${onda(CIMA)}" fill="url(#${id}-acqua)"/></g>
      </g>
    </svg>`);
}
