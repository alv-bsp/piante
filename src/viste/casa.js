import { html } from "../ui/html.js";
import { icona } from "../ui/icone.js";
import { livelloAcqua } from "../ui/livello.js";
import { inOrdine, cicliDi } from "../stato.js";
import { testata, vuoto, contaPiante, statoBreve, concimeBreve, verbi, dettagli, miniatura } from "./comuni.js";

export const titolo = "Casa";
export const conTabbar = true;

export const DA_SISTEMARE = "Da sistemare";

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
      const aMano = piante.filter((x) => !x.pianta.irrigazione_automatica).length;
      return html`
        <section class="stanza">
          <div class="stanza-testa">
            <h2 class="titoletto">${stanza} <span class="conta neutra">${piante.length}</span></h2>
            ${aMano >= 2 && stanza !== DA_SISTEMARE ? html`
              <button class="chip" type="button" data-azione="bagna-stanza" data-stanza="${stanza}">${icona("droplet", 16)}Bagna tutte</button>` : ""}
          </div>
          ${stanza === DA_SISTEMARE ? html`<p class="aiuto">Apri la pianta, tocca Modifica e scegli la stanza.</p>` : ""}
          <div class="pannello"><ul class="elenco">${piante.map(riga)}</ul></div>
        </section>`;
    })}`;
}

// Livello dell'acqua mostrato l'ultima volta, per pianta: se sale (l'hai appena bagnata) la goccia si riempie
// partendo da lì, invece di comparire già piena.
const livelliPrima = new Map();

/** Quanta acqua resta: piena il giorno in cui la bagni, vuota quando è ora di controllarla. */
const livelloDi = (st) => (st.giorni > 0 ? Math.min(1, Math.max(0, st.mancano / st.giorni)) : 0);

function riga({ pianta: p, stato: st }) {
  const v = verbi(p);
  const info = dettagli(p);
  const concime = concimeBreve(p, cicliDi(p));
  const livello = livelloDi(st);
  const prima = livelliPrima.get(p.id);
  livelliPrima.set(p.id, livello);
  return html`
    <li class="riga-pianta">
      <a class="riga" href="#/pianta/${p.id}">
        ${miniatura(p)}
        <span class="riga-testo">
          <span class="riga-nome">${p.nome}</span>
          ${info ? html`<span class="riga-meta">${info}</span>` : ""}
          <span class="riga-stato ${st.daControllare ? "scaduta" : ""}">${statoBreve(p, st)}</span>
          ${concime ? html`<span class="riga-stato concime">${concime}</span>` : ""}
        </span>
      </a>
      ${p.irrigazione_automatica ? "" : html`
        <button class="icona-btn goccia ${livello === 0 ? "asciutta" : ""}" type="button" data-azione="bagnata" data-id="${p.id}"
          aria-label="${p.nome}: ${v.fatta} adesso. Acqua rimasta: ${Math.round(livello * 100)}%">${livelloAcqua(v.icona, livello, { da: prima })}</button>`}
    </li>`;
}
