import { raw } from "./html.js";

// La mascotte: una goccia verde morbida, disegnata qui (SVG). Cambia faccia con lo stato della pianta:
//   felice · sete (da bagnare o da concimare) · grata (bagnata oggi) · dorme (a riposo)
const occhi = {
  felice: '<circle cx="44" cy="62" r="4.2"/><circle cx="76" cy="62" r="4.2"/>',
  sete: '<circle cx="44" cy="63" r="4.2"/><circle cx="76" cy="63" r="4.2"/>',
  grata: '<path d="M38 63q6-7 12 0M70 63q6-7 12 0" fill="none" stroke-width="3.4" stroke-linecap="round"/>',
  dorme: '<path d="M38 62q6 6 12 0M70 62q6 6 12 0" fill="none" stroke-width="3.4" stroke-linecap="round"/>',
};
const bocca = {
  felice: '<path d="M54 74q6 6 12 0" fill="none" stroke-width="3.2" stroke-linecap="round"/>',
  sete: '<ellipse cx="60" cy="77" rx="4.6" ry="5.4"/>',
  grata: '<path d="M52 72q8 10 16 0z"/>',
  dorme: '<path d="M56 76h8" fill="none" stroke-width="3" stroke-linecap="round"/>',
};
const extra = {
  felice: "",
  sete: '<path class="m-goccia" d="M96 38c4 6 6 9 6 12a6 6 0 0 1-12 0c0-3 2-6 6-12z" fill="#7dd3fc"/>',
  grata: '<ellipse cx="36" cy="72" rx="7" ry="4" fill="#ff8fa3" opacity=".55"/><ellipse cx="84" cy="72" rx="7" ry="4" fill="#ff8fa3" opacity=".55"/>',
  dorme: '<g class="m-zeta" fill="#e6ffd6" font-family="Jakarta, sans-serif" font-weight="800"><text x="92" y="34" font-size="14">z</text><text x="102" y="22" font-size="10">z</text></g>',
};

/**
 * `salta`: festeggia (l'umore è appena cambiato, es. l'hai appena bagnata).
 * Gli occhi aperti sbattono ogni tanto; la goccia si coccola con un tocco (vedi pianta.js).
 */
export function mascotte(umore = "felice", dimensione = 120, { salta = false } = {}) {
  return raw(`
    <svg class="mascotte m-${umore}${salta ? " m-festa" : ""}" width="${dimensione}" height="${dimensione}"
      viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <radialGradient id="m-corpo" cx="38%" cy="30%" r="75%">
          <stop offset="0" stop-color="#f1ffd0"/><stop offset=".45" stop-color="#b8f27a"/><stop offset="1" stop-color="#3fd673"/>
        </radialGradient>
      </defs>
      <ellipse class="m-ombra" cx="60" cy="114" rx="26" ry="4.5" fill="rgba(0,0,0,.28)"/>
      <g class="m-salto">
        <g class="m-corpo">
          <path d="M60 8c10 14 40 34 40 62a40 40 0 0 1-80 0C20 42 50 22 60 8z" fill="url(#m-corpo)"/>
          <ellipse cx="44" cy="40" rx="9" ry="5" fill="#fff" opacity=".55" transform="rotate(-35 44 40)"/>
          <g fill="#14321a" stroke="#14321a"><g class="m-occhi">${occhi[umore]}</g>${bocca[umore]}</g>
          ${extra[umore]}
        </g>
      </g>
    </svg>`);
}
