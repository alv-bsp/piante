// Template HTML con escape automatico: ogni valore interpolato è testo, salvo quelli passati da raw()
// o prodotti da un altro html``. Così nomi, note e marche non possono iniettare markup.
class Sicuro {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ESC[c]);
export const raw = (s) => new Sicuro(String(s));

function valore(v) {
  if (v instanceof Sicuro) return v.s;
  if (Array.isArray(v)) return v.map(valore).join("");
  if (v === false || v === null || v === undefined) return "";
  return esc(v);
}

export function html(parti, ...valori) {
  let out = parti[0];
  valori.forEach((v, i) => { out += valore(v) + parti[i + 1]; });
  return new Sicuro(out);
}
