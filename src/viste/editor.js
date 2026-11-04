import { html } from "../ui/html.js";
import { icona } from "../ui/icone.js";
import { stato, aggiorna, trovaPianta, stanze, tipi, prodotti } from "../stato.js";
import { salvaPianta } from "../dati.js";
import { sostituisci } from "../router.js";
import { toast } from "../ui/avvisi.js";
import { giornoRoma, stagione, MESI } from "../../supabase/functions/_shared/scadenze.js";
import { preparaFoto, urlInCache } from "../foto.js";
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
  irrigazione_automatica: false,
  cicli: [],           // cicli di concime: { id?, prodotto, ogni_giorni, dal_mese, al_mese, con_acqua, note }
  note: "",
  ultimaVolta: giornoRoma(),
  foto: null,          // foto nuova preparata nel browser
  fotoAttuale: null,   // percorso della foto già salvata
  fotoRimossa: false,
  inPreparazione: false,
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
  irrigazione_automatica: p.irrigazione_automatica,
  cicli: (stato.cicli.get(p.id) || []).map((c) => ({ ...c, note: c.note || "" })),
  note: p.note || "",
  ultimaVolta: "",
  fotoAttuale: p.foto,
});

const LIMITI = { giorni_estate: [1, 90], giorni_inverno: [1, 120], ogni_giorni: [1, 365] };

// Prodotti suggeriti oltre a quelli già usati (dalla memoria delle piante).
const PRODOTTI_NOTI = [
  "Compo liquido piante verdi", "Fortigo Frutti Bio", "Sangue di bue Flortis", "Granulare per agrumi",
  "Chelato di ferro EDDHA", "Concime per acidofile",
];

const cicloNuovo = (b) => ({
  prodotto: "", ogni_giorni: 21, dal_mese: 3, al_mese: 9, con_acqua: !b.irrigazione_automatica, note: "",
});

/** Foto scelta dal selettore (main.js): la prepara nel browser e la mostra subito. */
export function cambiaFoto(file) {
  if (!bozza) bozza = nuova();
  liberaAnteprime();
  bozza.foto = null;
  bozza.fotoRimossa = false;
  bozza.inPreparazione = true;
  aggiorna({});
  const questa = bozza;
  preparaFoto(file)
    .then((f) => {
      if (bozza !== questa) return URL.revokeObjectURL(f.anteprima);
      bozza.foto = f;
    })
    .catch((e) => {
      console.error("foto", e);
      toast("Non riesco a leggere questa foto. Prova con un'altra.");
    })
    .finally(() => {
      if (bozza === questa) {
        bozza.inPreparazione = false;
        aggiorna({});
      }
    });
}

function liberaAnteprime() {
  if (bozza?.foto) {
    URL.revokeObjectURL(bozza.foto.anteprima);
    URL.revokeObjectURL(bozza.foto.anteprimaMini);
  }
}

function anteprima(b) {
  if (b.inPreparazione) return html`<div class="foto grande attesa"><span>Preparo la foto…</span></div>`;
  if (b.foto) return html`<div class="foto grande"><img src="${b.foto.anteprima}" alt="Foto della pianta"></div>`;
  if (b.fotoAttuale && !b.fotoRimossa) {
    const src = urlInCache(b.fotoAttuale);
    return html`<div class="foto grande"><img data-foto="${b.fotoAttuale}" ${src ? html`src="${src}"` : ""} alt="Foto della pianta"></div>`;
  }
  return html`
    <button class="foto grande vuota" type="button" data-azione="scegli-foto">
      ${icona("camera", 30, 1.5)}<span>Aggiungi una foto</span>
    </button>`;
}

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
      <section class="editor-foto">
        ${anteprima(b)}
        ${b.foto || (b.fotoAttuale && !b.fotoRimossa) ? html`
          <div class="editor-foto-azioni">
            <button class="chip" type="button" data-azione="scegli-foto">${icona("camera", 18)}Cambia foto</button>
            <button class="link" type="button" data-azione="togli-foto">Togli foto</button>
          </div>` : ""}
      </section>

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
            <button class="chip" type="button" role="radio" aria-checked="${String(b.substrato === v)}" data-azione="substrato" data-valore="${v}">
              ${b.substrato === v ? icona("check", 15, 2.6) : ""}${nome}
            </button>`)}
        </div>
      </fieldset>

      <fieldset class="gruppo">
        <legend>Acqua</legend>
        <div class="chips" role="radiogroup" aria-label="Acqua">
          ${[[false, "A mano"], [true, "Automatica (Home Assistant)"]].map(([v, nome]) => html`
            <button class="chip" type="button" role="radio" aria-checked="${String(b.irrigazione_automatica === v)}" data-azione="irrigazione" data-valore="${String(v)}">
              ${b.irrigazione_automatica === v ? icona("check", 15, 2.6) : ""}${nome}
            </button>`)}
        </div>
      </fieldset>

      ${b.irrigazione_automatica ? "" : html`
        <fieldset class="gruppo">
          <legend>Controllala ogni</legend>
          <p class="aiuto">Giorni dall'ultima annaffiatura. Estate: da aprile a settembre.</p>
          ${passo("giorni_estate", "In estate", b.giorni_estate)}
          ${passo("giorni_inverno", "In inverno", b.giorni_inverno)}
        </fieldset>`}

      ${modifica || b.irrigazione_automatica ? "" : html`
        <label class="campo">
          <span>Ultima volta ${b.substrato === "idroponica" ? "rabboccata" : "bagnata"} <small>facoltativo</small></span>
          <input type="date" data-input="bozza" data-campo="ultimaVolta" value="${b.ultimaVolta}" max="${giornoRoma()}">
          <small class="aiuto">Se non lo sai, svuota il campo: il primo controllo arriva tra ${stagione(giornoRoma()) === "estate" ? b.giorni_estate : b.giorni_inverno} giorni.</small>
        </label>`}

      <fieldset class="gruppo" id="gruppo-concime">
        <legend>Concime</legend>
        <p class="aiuto">Un ciclo per prodotto: ogni quanti giorni e in quali mesi. Fuori dai mesi la pianta è a riposo.</p>
        <datalist id="prodotti">${[...new Set([...prodotti(), ...PRODOTTI_NOTI])].map((x) => html`<option value="${x}"></option>`)}</datalist>
        <div class="cicli-editor">${b.cicli.map((c, i) => cicloEditor(c, i, b))}</div>
        <button class="chip" type="button" data-azione="aggiungi-ciclo">${icona("plus", 16)}${b.cicli.length ? "Aggiungi un altro concime" : "Aggiungi un concime"}</button>
      </fieldset>

      <label class="campo">
        <span>Note <small>facoltative</small></span>
        <textarea data-input="bozza" data-campo="note" rows="3" maxlength="2000"
          placeholder="Es. bagnare quando i primi 3 cm sono asciutti">${b.note}</textarea>
      </label>
    </form>

    <div class="barra-salva">
      <button class="btn primario largo" type="button" data-azione="salva-pianta"
        ${b.salvataggio || b.inPreparazione ? html`aria-busy="true" disabled` : ""}>
        ${b.salvataggio ? "Salvo…" : b.inPreparazione ? "Preparo la foto…" : modifica ? "Salva modifiche" : "Aggiungi pianta"}
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

function cicloEditor(c, i, b) {
  const mesi = (campo, valore) => html`
    <select data-input="ciclo" data-campo="${i}:${campo}" aria-label="${campo === "dal_mese" ? "Dal mese" : "Al mese"}">
      ${MESI.map((m, k) => html`<option value="${k + 1}" ${k + 1 === valore ? "selected" : ""}>${m}</option>`)}
    </select>`;
  const [min, max] = LIMITI.ogni_giorni;
  return html`
    <div class="ciclo">
      <div class="ciclo-testa">
        <input type="text" data-input="ciclo" data-campo="${i}:prodotto" value="${c.prodotto}" maxlength="60" list="prodotti"
          placeholder="Prodotto, es. Compo liquido piante verdi" autocomplete="off" aria-label="Prodotto">
        <button class="icona-btn piccola" type="button" data-azione="togli-ciclo" data-i="${i}" aria-label="Togli questo concime">${icona("x", 16)}</button>
      </div>
      <div class="passo">
        <span class="passo-etichetta">Ogni</span>
        <button class="icona-btn" type="button" data-azione="passo-ciclo" data-i="${i}" data-delta="-1" aria-label="Un giorno in meno" ${c.ogni_giorni <= min ? "disabled" : ""}>${icona("minus", 18)}</button>
        <label class="passo-valore">
          <input type="number" inputmode="numeric" min="${min}" max="${max}" value="${c.ogni_giorni}" data-input="ciclo" data-campo="${i}:ogni_giorni" aria-label="Ogni quanti giorni">
          <span>giorni</span>
        </label>
        <button class="icona-btn" type="button" data-azione="passo-ciclo" data-i="${i}" data-delta="1" aria-label="Un giorno in più" ${c.ogni_giorni >= max ? "disabled" : ""}>${icona("plus", 18)}</button>
      </div>
      <div class="ciclo-mesi"><span>Da</span>${mesi("dal_mese", c.dal_mese)}<span>a</span>${mesi("al_mese", c.al_mese)}</div>
      ${b.irrigazione_automatica ? "" : html`
        <button class="chip" type="button" data-azione="ciclo-acqua" data-i="${i}" aria-pressed="${String(c.con_acqua)}">
          ${c.con_acqua ? icona("check", 15, 2.6) : ""}Sciolto nell'acqua
        </button>`}
      <input type="text" data-input="ciclo" data-campo="${i}:note" value="${c.note}" maxlength="300"
        placeholder="Nota, es. metà dose" autocomplete="off" aria-label="Nota sul concime" class="ciclo-nota">
    </div>`;
}

const limita = (campo, n) => {
  const [min, max] = LIMITI[campo];
  return Math.min(max, Math.max(min, Math.round(n)));
};

// ───────────────────────────── azioni
async function salva() {
  const b = bozza;
  if (!b || b.salvataggio || b.inPreparazione) return;
  const manca = !b.nome.trim() ? "nome" : !b.stanza.trim() ? "stanza" : null;
  if (manca) {
    toast(manca === "nome" ? "Scrivi il nome della pianta." : "Scegli la stanza.");
    document.querySelector(`#campo-${manca} input`)?.focus();
    return;
  }
  const senzaProdotto = b.cicli.findIndex((c) => !c.prodotto.trim());
  if (senzaProdotto >= 0) {
    toast("Scrivi il prodotto del concime, o togli il ciclo vuoto.");
    document.querySelector(`[data-campo="${senzaProdotto}:prodotto"]`)?.focus();
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
  "togli-foto": () => {
    liberaAnteprime();
    bozza.foto = null;
    bozza.fotoRimossa = Boolean(bozza.fotoAttuale);
    aggiorna({});
  },
  substrato: (el) => {
    bozza.substrato = el.dataset.valore;
    aggiorna({});
  },
  irrigazione: (el) => {
    bozza.irrigazione_automatica = el.dataset.valore === "true";
    aggiorna({});
  },
  "aggiungi-ciclo": () => {
    bozza.cicli = [...bozza.cicli, cicloNuovo(bozza)];
    aggiorna({});
    requestAnimationFrame(() => document.querySelector(`[data-campo="${bozza.cicli.length - 1}:prodotto"]`)?.focus());
  },
  "togli-ciclo": (el) => {
    bozza.cicli = bozza.cicli.filter((_, i) => i !== Number(el.dataset.i));
    aggiorna({});
  },
  "passo-ciclo": (el) => {
    const c = bozza.cicli[Number(el.dataset.i)];
    if (!c) return;
    c.ogni_giorni = limita("ogni_giorni", c.ogni_giorni + Number(el.dataset.delta));
    aggiorna({});
  },
  "ciclo-acqua": (el) => {
    const c = bozza.cicli[Number(el.dataset.i)];
    if (!c) return;
    c.con_acqua = !c.con_acqua;
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
  ciclo: (el) => {
    const [i, campo] = el.dataset.campo.split(":");
    const c = bozza?.cicli[Number(i)];
    if (!c) return;
    if (campo === "prodotto" || campo === "note") c[campo] = el.value;
    else if (el.value !== "" && Number.isFinite(Number(el.value))) {
      c[campo] = campo === "ogni_giorni" ? limita("ogni_giorni", Number(el.value)) : Number(el.value);
    }
  },
};

/** Annulla quando si esce dal form senza salvare. */
export function abbandona() {
  liberaAnteprime();
  bozza = null;
}
