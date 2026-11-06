import { html } from "../ui/html.js";
import { icona } from "../ui/icone.js";
import { stato, aggiorna, trovaPianta, stanze, tipi, prodotti } from "../stato.js";
import { salvaPianta, aggiungiSpecie } from "../dati.js";
import { sostituisci } from "../router.js";
import { toast } from "../ui/avvisi.js";
import { giornoRoma, stagione, MESI } from "../../supabase/functions/_shared/scadenze.js";
import { cercaSpecie, fotoSpecie, specieDi, normalizza, GENERICA } from "../specie.js";
import { concimeConsigliato, programmaDi, stessiCicli } from "../concimi.js";
import { barra, vuoto, foto } from "./comuni.js";

export const conTabbar = false;

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
  cicliAuto: true,     // i cicli vengono dalla specie e non li hai toccati: cambiando specie si aggiornano
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
  irrigazione_automatica: p.irrigazione_automatica,
  cicli: (stato.cicli.get(p.id) || []).map((c) => ({ ...c, note: c.note || "" })),
  cicliAuto: !(stato.cicli.get(p.id) || []).length,
  note: p.note || "",
  ultimaVolta: "",
});

const LIMITI = { giorni_estate: [1, 90], giorni_inverno: [1, 120], ogni_giorni: [1, 365] };

// Prodotti suggeriti oltre a quelli già usati (dalla memoria delle piante).
const PRODOTTI_NOTI = [
  "Compo liquido piante verdi", "Concime liquido piante fiorite", "Concime per cactus e succulente",
  "Concime per idrocoltura", "Fortigo Frutti Bio", "Sangue di bue Flortis", "Granulare per agrumi",
  "Chelato di ferro EDDHA", "Concime per acidofile",
];

/** Se i cicli vengono ancora dalla specie, li rifà (specie, substrato o irrigazione cambiati). */
function ricalcolaConcime() {
  if (bozza?.cicliAuto) bozza.cicli = concimeConsigliato(bozza, stato.specieMie);
}

/** Riga "Consigliato per …" sopra i cicli, con il pulsante per usarlo se i cicli sono diversi. */
function consiglioConcime(b) {
  const specie = specieDi(b);
  const nomeSpecie = specie !== GENERICA ? specie.nome : b.tipo.trim();
  if (!nomeSpecie) return "";
  const consigliato = concimeConsigliato(b, stato.specieMie);
  const { nome } = programmaDi(b, stato.specieMie);
  const uguale = stessiCicli(b.cicli, consigliato);
  return html`
    <div class="consiglio-concime">
      <p>${icona("sprout", 16)}<span>Per ${nomeSpecie}: <b>${nome.toLowerCase()}</b>${consigliato.length ? "" : ", nessun concime"}.</span></p>
      ${uguale ? "" : html`<button class="chip" type="button" data-azione="concime-consigliato">${icona("undo", 15)}Usa il consigliato</button>`}
    </div>`;
}

const cicloNuovo = (b) => ({
  prodotto: "", ogni_giorni: 21, dal_mese: 3, al_mese: 9, con_acqua: !b.irrigazione_automatica, note: "",
});

// ───────────────────────────── campi con ricerca (Specie, Stanza)
// Mentre scrivi, sotto compaiono le voci che corrispondono; se non c'è, l'ultima riga la aggiunge com'è.
// La pagina non si ridisegna mentre scrivi (su iPhone si chiuderebbe la tastiera): cambia solo l'elenco.

/** Campo con ricerca: `nome` è specie o stanza, `valore` il testo attuale. */
function campoCerca({ nome, etichetta, valore, segnaposto, iconaCampo = "", maiuscole = "words" }) {
  return html`
    <div class="campo cerca" id="campo-${nome}">
      <label for="${nome}"><span>${etichetta}</span></label>
      <div class="cerca-riga">
        ${iconaCampo ? icona(iconaCampo, 18) : ""}
        <input type="text" id="${nome}" data-input="cerca" data-cerca="${nome}" data-campo="${nome}" value="${valore}" maxlength="40"
          placeholder="${segnaposto}" autocomplete="off" autocapitalize="${maiuscole}" spellcheck="false"
          role="combobox" aria-expanded="false" aria-controls="${nome}-elenco" aria-autocomplete="list">
        ${valore ? html`<button class="icona-btn piccola" type="button" data-azione="cerca-svuota" data-nome="${nome}" aria-label="Cancella">${icona("x", 16)}</button>` : ""}
      </div>
      <ul class="suggerimenti" id="${nome}-elenco" role="listbox" hidden></ul>
    </div>`;
}

const riga = (nome, valore, contenuto, classe = "") => html`
  <li role="option">
    <button class="suggerimento ${classe}" type="button" data-azione="cerca-scegli" data-cerca="${nome}" data-valore="${valore}">${contenuto}</button>
  </li>`;

/** Specie: decide la foto. Specie note con la foto, più quelle senza foto che hai già usato. */
function suggerimentiSpecie(testo) {
  const { risultati, esiste } = cercaSpecie(testo, [...tipi(), ...stato.specieMie.map((x) => x.nome)]);
  const nuova = testo.trim();
  // Una parola sola che è un genere noto ("Ficus") prende comunque la foto della specie: lo dico.
  const trovata = nuova && specieDi({ tipo: nuova });
  const conFoto = trovata?.file ? trovata : null;
  return html`
    ${risultati.slice(0, 30).map((r) => riga("specie", r.nome, html`
      ${r.specie
        ? html`<span class="foto mini"><img src="${fotoSpecie(r.specie, "mini")}" alt="" loading="lazy"></span>`
        : html`<span class="foto mini senza-foto">${icona("sprout", 20, 1.6)}</span>`}
      <span class="riga-testo">
        <span class="riga-nome">${r.nome}</span>
        ${r.specie ? "" : html`<span class="riga-meta">Senza foto</span>`}
      </span>`))}
    ${nuova && !esiste ? riga("specie", nuova, html`
      <span class="foto mini senza-foto">${icona("plus", 20, 2)}</span>
      <span class="riga-testo">
        <span class="riga-nome">Aggiungi «${nuova}»</span>
        <span class="riga-meta">${conFoto ? `Con la foto di ${conFoto.nome}` : "Specie nuova, senza foto"}</span>
      </span>`, "nuova") : ""}`;
}

/** Stanza: solo testo. Le stanze che hai già (prima quelle che iniziano così), o una nuova. */
function suggerimentiStanza(testo) {
  const q = normalizza(testo);
  const tutte = stanze().filter((x) => x !== "Da sistemare");
  const punteggio = (x) => {
    const n = normalizza(x);
    if (!q || n.startsWith(q)) return 0;
    if (n.split(/\s+/).some((parola) => parola.startsWith(q))) return 1;
    return n.includes(q) ? 2 : null;
  };
  const trovate = tutte
    .map((x) => ({ x, p: punteggio(x) }))
    .filter((v) => v.p != null)
    .sort((a, b) => a.p - b.p || a.x.localeCompare(b.x, "it"))
    .map((v) => v.x);
  const nuova = testo.trim();
  const esiste = tutte.some((x) => normalizza(x) === q);
  return html`
    ${trovate.map((x) => riga("stanza", x, html`<span class="riga-nome">${x}</span>`, "solo-testo"))}
    ${nuova && !esiste ? riga("stanza", nuova, html`
      <span class="riga-testo">
        <span class="riga-nome">Aggiungi «${nuova}»</span>
        <span class="riga-meta">Stanza nuova</span>
      </span>`, "solo-testo nuova") : ""}`;
}

const CERCA = {
  specie: { campo: "tipo", righe: suggerimentiSpecie, dopo: () => aggiornaAnteprima() },
  stanza: { campo: "stanza", righe: suggerimentiStanza, dopo: () => {} },
};

/** Mostra (o nasconde) l'elenco sotto il campo, senza ridisegnare la pagina. */
function mostraSuggerimenti(nome, aperto = true) {
  const campo = document.getElementById(nome);
  const elenco = document.getElementById(`${nome}-elenco`);
  if (!campo || !elenco || !CERCA[nome]) return;
  if (aperto) elenco.innerHTML = String(CERCA[nome].righe(campo.value));
  const pieno = aperto && elenco.children.length > 0;
  elenco.hidden = !pieno;
  campo.setAttribute("aria-expanded", String(pieno));
  if (pieno) elenco.scrollTop = 0;
}

/** Aggiorna la foto in cima al form, senza ridisegnare (il campo resta com'è, con la tastiera aperta). */
function aggiornaAnteprima() {
  const vecchia = document.querySelector("#form-pianta > .foto");
  if (vecchia && bozza) vecchia.outerHTML = String(foto(bozza, "copertina"));
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
      ${foto(b, "copertina")}
      ${campoCerca({ nome: "specie", etichetta: "Specie", valore: b.tipo, segnaposto: "Cerca: Monstera, Ficus, Sansevieria…", iconaCampo: "sprout" })}

      <label class="campo" id="campo-nome">
        <span>Nome</span>
        <input type="text" data-input="bozza" data-campo="nome" value="${b.nome}" maxlength="60"
          placeholder="Es. Monstera deliciosa" autocomplete="off" autocapitalize="sentences" required>
      </label>
      ${campoCerca({ nome: "stanza", etichetta: "Stanza", valore: b.stanza, segnaposto: "Es. Salotto, Camera", maiuscole: "sentences" })}
      <label class="campo">
        <span>Vaso <small>facoltativo</small></span>
        <input type="text" data-input="bozza" data-campo="vaso" value="${b.vaso}" maxlength="80"
          placeholder="Es. Vaso bianco con gambe" autocomplete="off">
      </label>

      <fieldset class="gruppo">
        <legend>Substrato</legend>
        <div class="chips" role="radiogroup" aria-label="Substrato">
          ${[["terra", "Terra"], ["idroponica", "Idroponica"]].map(([v, nome]) => html`
            <button class="chip substrato-chip ${v}" type="button" role="radio" aria-checked="${String(b.substrato === v)}" data-azione="substrato" data-valore="${v}">
              ${icona(v === "terra" ? "vaso" : "glass", 18, 2.1)}${nome}
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
        <p class="aiuto">Lo sceglie la specie: puoi cambiarlo. Un ciclo per prodotto, ogni quanti giorni e in quali mesi; fuori dai mesi la pianta è a riposo.</p>
        ${consiglioConcime(b)}
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
  if (!b || b.salvataggio) return;
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
    // Specie nuova scritta a mano: la ricordo, così la ritrovi nella ricerca e in Account › Specie.
    if (p.tipo && specieDi(p) === GENERICA && stato.specieMieOk) {
      aggiungiSpecie(p.tipo).catch((e) => console.error("specie", e));
    }
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
  "cerca-scegli": (el) => {
    const nome = el.dataset.cerca;
    bozza[CERCA[nome].campo] = el.dataset.valore;
    if (nome === "specie") {
      if (!bozza.nome.trim()) bozza.nome = el.dataset.valore;
      ricalcolaConcime();
    }
    document.getElementById(nome)?.blur();
    aggiorna({});
  },
  "cerca-svuota": (el) => {
    const nome = el.dataset.nome;
    bozza[CERCA[nome].campo] = "";
    aggiorna({});
    document.getElementById(nome)?.focus(); // dentro il tocco: su iPhone si apre la tastiera
  },
  substrato: (el) => {
    bozza.substrato = el.dataset.valore;
    ricalcolaConcime();
    aggiorna({});
  },
  irrigazione: (el) => {
    bozza.irrigazione_automatica = el.dataset.valore === "true";
    ricalcolaConcime();
    aggiorna({});
  },
  "concime-consigliato": () => {
    bozza.cicliAuto = true;
    ricalcolaConcime();
    aggiorna({});
  },
  "aggiungi-ciclo": () => {
    bozza.cicliAuto = false;
    bozza.cicli = [...bozza.cicli, cicloNuovo(bozza)];
    aggiorna({});
    requestAnimationFrame(() => document.querySelector(`[data-campo="${bozza.cicli.length - 1}:prodotto"]`)?.focus());
  },
  "togli-ciclo": (el) => {
    bozza.cicliAuto = false;
    bozza.cicli = bozza.cicli.filter((_, i) => i !== Number(el.dataset.i));
    aggiorna({});
  },
  "passo-ciclo": (el) => {
    const c = bozza.cicli[Number(el.dataset.i)];
    if (!c) return;
    bozza.cicliAuto = false;
    c.ogni_giorni = limita("ogni_giorni", c.ogni_giorni + Number(el.dataset.delta));
    aggiorna({});
  },
  "ciclo-acqua": (el) => {
    const c = bozza.cicli[Number(el.dataset.i)];
    if (!c) return;
    bozza.cicliAuto = false;
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
  cerca: (el) => {
    const c = CERCA[el.dataset.cerca];
    if (!bozza || !c) return;
    bozza[c.campo] = el.value;
    mostraSuggerimenti(el.dataset.cerca, true);
    c.dopo();
  },
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
    bozza.cicliAuto = false;
    if (campo === "prodotto" || campo === "note") c[campo] = el.value;
    else if (el.value !== "" && Number.isFinite(Number(el.value))) {
      c[campo] = campo === "ogni_giorni" ? limita("ogni_giorni", Number(el.value)) : Number(el.value);
    }
  },
};

/** Campi con ricerca: elenco aperto quando li tocchi, chiuso quando esci; Invio sceglie il primo, Esc chiude. */
export const ricerca = {
  apri: (nome) => mostraSuggerimenti(nome, true),
  chiudi: (nome) => mostraSuggerimenti(nome, false),
  tasto: (e) => {
    const nome = e.target.dataset.cerca;
    if (e.key === "Escape") {
      mostraSuggerimenti(nome, false);
      e.target.blur();
    } else if (e.key === "Enter") {
      e.preventDefault();
      document.querySelector(`#${nome}-elenco .suggerimento`)?.click();
    }
  },
};

/** Annulla quando si esce dal form senza salvare. */
export function abbandona() {
  bozza = null;
}
