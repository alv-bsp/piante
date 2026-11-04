import { html } from "../ui/html.js";
import { icona } from "../ui/icone.js";
import { inOrdine } from "../stato.js";
import { testata, vuoto, contaPiante, statoBreve, verbi, dettagli, miniatura } from "./comuni.js";

export const titolo = "Casa";
export const conTabbar = true;

const DA_SISTEMARE = "Da sistemare";

export function render(s, { avviso = "" } = {}) {
  if (s.piante == null) return html`${testata(titolo, s.caricamento ? "Carico…" : "")}${avviso}`;

  const tutte = inOrdine();
  if (!tutte.length) {
    return html`${testata(titolo)}${avviso}${vuoto({
      icona: "house",
      titolo: "La casa è vuota",
      testo: "Aggiungi una pianta con la sua stanza: qui le trovi divise per stanza.",
      azione: html`<a class="btn primario" href="#/nuova">${icona("plus")}Aggiungi una pianta</a>`,
    })}`;
  }

  // Per stanza; "Da sistemare" in cima, così si nota. Dentro la stanza, in ordine di nome.
  const perStanza = new Map();
  for (const x of tutte) perStanza.set(x.pianta.stanza, [...(perStanza.get(x.pianta.stanza) || []), x]);
  const ordine = [...perStanza.keys()].sort((a, b) =>
    (b === DA_SISTEMARE) - (a === DA_SISTEMARE) || a.localeCompare(b, "it"));

  const nStanze = ordine.filter((n) => n !== DA_SISTEMARE).length;
  const sotto = `${contaPiante(tutte.length)} · ${nStanze === 1 ? "1 stanza" : `${nStanze} stanze`}`;

  return html`
    ${testata(titolo, sotto)}
    ${avviso}
    ${ordine.map((stanza) => {
      const piante = perStanza.get(stanza).sort((a, b) => a.pianta.nome.localeCompare(b.pianta.nome, "it"));
      return html`
        <section class="stanza">
          <h2 class="titoletto">${stanza} <span class="conta neutra">${piante.length}</span></h2>
          ${stanza === DA_SISTEMARE ? html`<p class="aiuto">Apri la pianta, tocca Modifica e scegli la stanza.</p>` : ""}
          <ul class="elenco">${piante.map(riga)}</ul>
        </section>`;
    })}`;
}

function riga({ pianta: p, stato: st }) {
  const v = verbi(p);
  const info = dettagli(p);
  return html`
    <li class="riga-pianta">
      <a class="riga" href="#/pianta/${p.id}">
        ${miniatura(p)}
        <span class="riga-testo">
          <span class="riga-nome">${p.nome}</span>
          ${info ? html`<span class="riga-meta">${info}</span>` : ""}
          <span class="riga-stato ${st.daControllare ? "scaduta" : ""}">${statoBreve(p, st)}</span>
        </span>
      </a>
      <button class="icona-btn goccia" type="button" data-azione="bagnata" data-id="${p.id}"
        aria-label="${p.nome}: ${v.fatta} adesso">${icona(v.icona, 20)}</button>
    </li>`;
}

export const fab = () => html`
  <a class="btn primario fab" href="#/nuova">${icona("plus")}Pianta</a>`;
