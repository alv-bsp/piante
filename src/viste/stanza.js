// "Bagna tutte": foglio con le piante di una stanza, tutte spuntate. Togli quelle che hai saltato e conferma:
// un solo salvataggio, un solo Annulla. Le piante con irrigazione automatica non ci sono.
import { html } from "../ui/html.js";
import { icona } from "../ui/icone.js";
import { attive, trovaPianta, statoDi } from "../stato.js";
import { registraCure } from "../dati.js";
import { apriFoglio, chiudiFoglio, toast } from "../ui/avvisi.js";
import { idrataFoto } from "../foto.js";
import { miniatura, statoBreve, contaPiante } from "./comuni.js";
import { annulla } from "./cure.js";

const etichetta = (n) => (n ? `Segna ${n === 1 ? "1 bagnata" : `${n} bagnate`}` : "Nessuna spuntata");

function render(stanza) {
  const piante = attive()
    .filter((p) => p.stanza === stanza && !p.irrigazione_automatica)
    .sort((a, b) => a.nome.localeCompare(b.nome, "it"));
  return html`
    <div class="maniglia" aria-hidden="true"></div>
    <div class="foglio-testa">
      <h2 id="foglio-titolo">Bagna tutte · ${stanza}</h2>
      <button class="icona-btn" type="button" data-azione="chiudi-foglio" aria-label="Chiudi">${icona("x")}</button>
    </div>
    <p class="foglio-testo">Togli la spunta a quelle che hai saltato.</p>
    <ul class="spunte">${piante.map((p) => html`
      <li>
        <label class="spunta">
          <input type="checkbox" checked data-spunta="${p.id}">
          ${miniatura(p)}
          <span class="riga-testo">
            <span class="riga-nome">${p.nome}</span>
            <span class="riga-meta">${statoBreve(p, statoDi(p))}</span>
          </span>
        </label>
      </li>`)}
    </ul>
    <div class="foglio-azioni">
      <button class="btn" type="button" data-azione="chiudi-foglio">Annulla</button>
      <button class="btn primario" type="button" data-azione="conferma-stanza" id="conferma-stanza">${etichetta(piante.length)}</button>
    </div>`;
}

const spuntate = () => [...document.querySelectorAll("#foglio [data-spunta]:checked")].map((el) => el.dataset.spunta);

/** Aggiorna il pulsante quando cambi una spunta (main.js, evento change). */
export function aggiornaConteggio() {
  const n = spuntate().length;
  const b = document.getElementById("conferma-stanza");
  if (!b) return;
  b.textContent = etichetta(n);
  b.disabled = n === 0;
}

export const azioni = {
  "bagna-stanza": (el) => {
    apriFoglio(render(el.dataset.stanza), "stanza");
    idrataFoto(document.getElementById("foglio"));
  },
  "conferma-stanza": async (el) => {
    const ids = spuntate().filter((id) => trovaPianta(id));
    if (!ids.length) return;
    el.disabled = true;
    el.setAttribute("aria-busy", "true");
    const il = new Date().toISOString();
    try {
      const righe = await registraCure(ids.map((pianta_id) => ({ pianta_id, tipo: "bagnata", il })));
      chiudiFoglio();
      toast(`${contaPiante(righe.length)} segnate come bagnate.`, { azione: () => annulla(righe) });
    } catch (e) {
      console.error("bagna stanza", e);
      el.disabled = false;
      el.removeAttribute("aria-busy");
      toast(navigator.onLine ? "Non sono riuscito a salvarle. Riprova." : "Sei offline: riprova quando c'è rete.");
    }
  },
};
