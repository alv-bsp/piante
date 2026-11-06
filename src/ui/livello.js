import { raw } from "./html.js";

// La goccia (o il bicchiere, per l'idroponica) che si svuota: piena il giorno in cui bagni, vuota quando è ora di
// controllare. Dentro c'è acqua vera e propria: un'onda che scorre piano, ritagliata sulla forma dell'icona.
// Stesse forme delle icone Lucide droplet e glass (src/ui/icone.js).
const FORME = {
  droplet: { d: "M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z", cima: 2, fondo: 22 },
  glass: { d: "M5.116 4.104A1 1 0 0 1 6.11 3h11.78a1 1 0 0 1 .994 1.105L17.19 20.21A2 2 0 0 1 15.2 22H8.8a2 2 0 0 1-2-1.79z", cima: 3, fondo: 22 },
};

// L'onda: mezze onde larghe 6, da x=-24 a x=24, così scorrendo di 12 (un periodo) copre sempre l'icona.
const onda = (y) => `M-24 ${y}q3 -1.4 6 0${" t6 0".repeat(7)}V26H-24Z`;

const tra0e1 = (x) => Math.min(1, Math.max(0, x));
let progressivo = 0;

/**
 * `livello` da 0 (vuota) a 1 (piena). `da`: livello di prima, se è appena salito (hai bagnato): l'acqua sale da lì.
 * Gli id di clipPath e gradiente sono unici per icona, perché nella pagina ce ne sono tante.
 */
export function livelloAcqua(forma, livello, { da = null, dimensione = 24 } = {}) {
  const f = FORME[forma] || FORME.droplet;
  const l = tra0e1(livello);
  const altezza = f.fondo - f.cima + 1.6; // un filo in più: l'onda bassa non lascia vuota la punta
  // A zero scende ancora un po', perché le creste dell'onda non spuntino dal fondo.
  const vuoto = (x) => ((1 - tra0e1(x)) * altezza + (tra0e1(x) === 0 ? 1.2 : 0)).toFixed(2);
  const id = `livello-${++progressivo}`;
  const sale = da != null && l > da;
  const stile = `--vuoto:${vuoto(l)};--pieno:${altezza.toFixed(2)}${sale ? `;--da:${vuoto(da)}` : ""}`;
  return raw(`
    <svg class="livello${sale ? " sale" : ""}${l === 0 ? " asciutta" : ""}" width="${dimensione}" height="${dimensione}" viewBox="0 0 24 24"
      aria-hidden="true" focusable="false" style="${stile}">
      <defs>
        <clipPath id="${id}"><path d="${f.d}"/></clipPath>
        <linearGradient id="${id}-acqua" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#7dd3fc"/><stop offset="1" stop-color="#0ea5e9"/>
        </linearGradient>
      </defs>
      <g clip-path="url(#${id})">
        <g class="livello-acqua"><path class="livello-onda" d="${onda(f.cima - 1.6)}" fill="url(#${id}-acqua)"/></g>
      </g>
      <path d="${f.d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`);
}
