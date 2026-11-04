import { html } from "../ui/html.js";
import { icona } from "../ui/icone.js";
import { aggiorna, trovaPianta, stanze, tipi } from "../stato.js";
import { salvaPianta } from "../dati.js";
import { sostituisci } from "../router.js";
import { toast } from "../ui/avvisi.js";
import { giornoRoma, stagione } from "../../supabase/functions/_shared/scadenze.js";
import { barra, vuoto } from "./comuni.js";

export const conTabbar = false;
export const fab = () => "";

// La bozza vive qui finché non la salvi o esci. I campi di testo la aggiornano senza ridisegnare.
let bozza = null;

const nuova = () => ({
  id: null,
  nome: "",
  tipo: "",
  stanza: "",
  vaso: "",
  substrato: "terra",
  giorni_estate: 7,
  giorni_inverno: 14,
  note: "",
  ultimaVolta: giornoRoma(),
  salvataggio: false,
});

const daPianta = (p) => ({
  ...nuova(),
  id: p.id,
  nome: p.nome,
  tipo: p.tipo || "",
  stanza: p.stanza === "Da sistemare" ? "" : p.stanza,
  vaso: p.vaso || "",
  substrato: p.substrato,
  giorni_estate: p.giorni_estate,
  giorni_inverno: p.giorni_inverno,
  note: p.note || "",
  ultimaVolta: "",
});

const LIMITI = { giorni_estate: [1, 90], giorni_inverno: [1, 120] };

export function render(s, { rotta }) {
  const modifica = rotta.nome === "pianta";
  const id = modifica ? rotta.param[0] : null;
  if (modifica) {
    if (s.piante == null) return html`${barra({ indietro: "Annulla", href: "#/casa" })}<p class="nota">Carico…</p>`;
    const p = trovaPianta(id);
    if (!p) return html`${barra({ indietro: "Casa", href: "#/casa" })}${vuoto({ icona: "sprout", titolo: "Pianta non trovata", testo: "Forse è stata eliminata." })}`;
    if (bozza?.id !== id) bozza = daPianta(p);
  } else if (!bozza || bozza.id) {
    bozza = nuova();
  }

  const b = bozza;
  const href = modifica ? `#/pianta/${id}` : "#/casa";
  return html`
    ${barra({ indietro: "Annulla", href, titolo: modifica ? "Modifica pianta" : "Nuova pianta" })}
    <form class="editor" id="form-pianta" novalidate>
      <label class="campo" id="campo-nome">
        <span>Nome</span>
        <input type="text" data-input="bozza" data-campo="nome" value="${b.nome}" maxlength="60"
          placeholder="Es. Monstera deliciosa" autocomplete="off" autocapitalize="sentences" required>
      </label>
      <label class="campo">
        <span>Tipo <small>facoltativo</small></span>
        <input type="text" data-input="bozza" data-campo="tipo" value="${b.tipo}" maxlength="40" list="tipi"
          placeholder="Es. Monstera, Ficus, Begonia" autocomplete="off" autocapitalize="words">
        <datalist id="tipi">${tipi().map((t) => html`<option value="${t}"></option>`)}</datalist>
      </label>
      <label class="campo" id="campo-stanza">
        <span>Stanza</span>
        <input type="text" data-input="bozza" data-campo="stanza" value="${b.stanza}" maxlength="40" list="stanze"
          placeholder="Es. Salotto, Camera" autocomplete="off" autocapitalize="sentences" required>
        <datalist id="stanze">${stanze().filter((x) => x !== "Da sistemare").map((x) => html`<option value="${x}"></option>`)}</datalist>
      </label>
      <label class="campo">
        <span>Vaso <small>facoltativo</small></span>
        <input type="text" data-input="bozza" data-campo="vaso" value="${b.vaso}" maxlength="80"
          placeholder="Es. Vaso bianco con gambe" autocomplete="off">
      </label>

      <fieldset class="gruppo">
        <legend>Substrato</legend>
        <div class="chips" role="radiogroup" aria-label="Substrato">
          ${[["terra", "Terra"], ["idroponica", "Idroponica"]].map(([v, nome]) => html`
            <button class="chip" type="button" role="radio" aria-checked="${b.substrato === v}" data-azione="substrato" data-valore="${v}">
              ${b.substrato === v ? icona("check", 15, 2.6) : ""}${nome}
            </button>`)}
        </div>
      </fieldset>

      <fieldset class="gruppo">
        <legend>Controllala ogni</legend>
        <p class="aiuto">Giorni dall'ultima annaffiatura. Estate: da aprile a settembre.</p>
        ${passo("giorni_estate", "In estate", b.giorni_estate)}
        ${passo("giorni_inverno", "In inverno", b.giorni_inverno)}
      </fieldset>

      ${modifica ? "" : html`
        <label class="campo">
          <span>Ultima volta ${b.substrato === "idroponica" ? "rabboccata" : "bagnata"} <small>facoltativo</small></span>
          <input type="date" data-input="bozza" data-campo="ultimaVolta" value="${b.ultimaVolta}" max="${giornoRoma()}">
          <small class="aiuto">Se non lo sai, svuota il campo: il primo controllo arriva tra ${stagione(giornoRoma()) === "estate" ? b.giorni_estate : b.giorni_inverno} giorni.</small>
        </label>`}

      <label class="campo">
        <span>Note <small>facoltative</small></span>
        <textarea data-input="bozza" data-campo="note" rows="3" maxlength="2000"
          placeholder="Es. bagnare quando i primi 3 cm sono asciutti">${b.note}</textarea>
      </label>
    </form>

    <div class="barra-salva">
      <button class="btn primario largo" type="button" data-azione="salva-pianta"
        ${b.salvataggio ? html`aria-busy="true" disabled` : ""}>
        ${b.salvataggio ? "Salvo…" : modifica ? "Salva modifiche" : "Aggiungi pianta"}
      </button>
    </div>`;
}

function passo(campo, etichetta, valore) {
  const [min, max] = LIMITI[campo];
  return html`
    <div class="passo">
      <span class="passo-etichetta">${etichetta}</span>
      <button class="icona-btn" type="button" data-azione="passo" data-campo="${campo}" data-delta="-1"
        aria-label="${etichetta}: un giorno in meno" ${valore <= min ? "disabled" : ""}>${icona("minus", 18)}</button>
      <label class="passo-valore">
        <input type="number" inputmode="numeric" min="${min}" max="${max}" value="${valore}"
          data-input="giorni" data-campo="${campo}" aria-label="${etichetta}, giorni">
        <span>giorni</span>
      </label>
      <button class="icona-btn" type="button" data-azione="passo" data-campo="${campo}" data-delta="1"
        aria-label="${etichetta}: un giorno in più" ${valore >= max ? "disabled" : ""}>${icona("plus", 18)}</button>
    </div>`;
}

const limita = (campo, n) => {
  const [min, max] = LIMITI[campo];
  return Math.min(max, Math.max(min, Math.round(n)));
};

// ───────────────────────────── azioni
async function salva() {
  const b = bozza;
  if (!b || b.salvataggio) return;
  const manca = !b.nome.trim() ? "nome" : !b.stanza.trim() ? "stanza" : null;
  if (manca) {
    toast(manca === "nome" ? "Scrivi il nome della pianta." : "Scegli la stanza.");
    document.querySelector(`#campo-${manca} input`)?.focus();
    return;
  }
  b.salvataggio = true;
  aggiorna({});
  try {
    const p = await salvaPianta(b);
    const eraNuova = !b.id;
    bozza = null;
    toast(eraNuova ? `${p.nome} aggiunta.` : "Modifiche salvate.");
    sostituisci(eraNuova ? "casa" : `pianta/${p.id}`);
  } catch (e) {
    console.error("salvataggio", e);
    b.salvataggio = false;
    aggiorna({});
    toast("Salvataggio non riuscito. Riprova.");
  }
}

export const azioni = {
  substrato: (el) => {
    bozza.substrato = el.dataset.valore;
    aggiorna({});
  },
  passo: (el) => {
    const { campo, delta } = el.dataset;
    bozza[campo] = limita(campo, bozza[campo] + Number(delta));
    aggiorna({});
  },
  "salva-pianta": salva,
};

export const input = {
  bozza: (el) => {
    if (bozza) bozza[el.dataset.campo] = el.value;
  },
  giorni: (el) => {
    const n = Number(el.value);
    if (bozza && el.value !== "" && Number.isFinite(n)) bozza[el.dataset.campo] = limita(el.dataset.campo, n);
  },
};

/** Annulla quando si esce dal form senza salvare. */
export function abbandona() {
  bozza = null;
}
