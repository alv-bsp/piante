import "./stile/tokens.css";
import "./stile/base.css";
import "./stile/componenti.css";

import { configurato } from "./config.js";
import { sb } from "./supabase.js";
import { stato, aggiorna, ascolta, azzeraDati, quanteDaFare } from "./stato.js";
import { caricaTutto, aggiungiPiante } from "./dati.js";
import { verificaNotifiche, aggiornaBadge } from "./notifiche.js";
import { idrataFoto } from "./foto.js";
import { PIANTE_DI_PARTENZA } from "./partenza.js";
import { esci } from "./accesso.js";
import { rotta, normalizza, SEZIONI } from "./router.js";
import { html } from "./ui/html.js";
import { icona } from "./ui/icone.js";
import { toast, chiudiFoglio, preparaFoglio } from "./ui/avvisi.js";
import { transizione } from "./ui/effetti.js";
import { specieDi, fotoSpecie } from "./specie.js";
import { avviso } from "./viste/comuni.js";
import * as oggi from "./viste/oggi.js";
import * as casa from "./viste/casa.js";
import * as pianta from "./viste/pianta.js";
import * as editor from "./viste/editor.js";
import * as cure from "./viste/cure.js";
import * as stanza from "./viste/stanza.js";
import * as accesso from "./viste/accesso.js";
import * as account from "./viste/account.js";

const TAB = {
  oggi: { etichetta: "Calendario", icona: "calendar" },
  casa: { etichetta: "Casa", icona: "house" },
};
const app = document.getElementById("app");
const sceltaFoto = document.getElementById("scegli-foto");
let fotoPer = null; // id della pianta a cui va la foto del diario

function vistaPer(r) {
  if (r.nome === "nuova") return editor;
  if (r.nome === "pianta") return r.param[1] === "modifica" ? editor : pianta;
  return { oggi, casa }[r.nome];
}

/** Profondità della pagina: sezioni 0, scheda 1, modifica e nuova 2. Decide se la transizione va avanti o indietro. */
const profondita = (r) => (r.nome === "pianta" ? (r.param[1] === "modifica" ? 2 : 1) : r.nome === "nuova" ? 2 : 0);

// Entrata della pagina: i blocchi salgono a cascata per ~700 ms dopo un cambio pagina o il primo caricamento.
// Se nel frattempo la pagina si ridisegna (arrivano lo storico o il diario), --gia fa ripartire le animazioni
// da dove erano, invece che da capo.
// Il verso dipende da dove vai: "avanti" entra da destra, "indietro" da sinistra, "su" (tab e primo caricamento) dal basso.
const ENTRATA_MS = 700;
let entrataDa = -Infinity;
let versoEntrata = "su";
const segnaEntrata = (verso = "su") => {
  entrataDa = performance.now();
  versoEntrata = verso;
};

// Contatore sulla tab e sezione attiva: animati solo quando cambiano.
let ultimoConta = null;
let ultimaSezione = null;

// ───────────────────────────────────────── disegno
function guscio() {
  const r = rotta();
  const v = vistaPer(r);
  const n = stato.piante ? quanteDaFare() : 0;
  document.title = n ? `(${n}) Piante` : "Piante";
  const contenuto = v.render(stato, { rotta: r, avviso: stato.errore ? avviso(stato.errore) : "" });
  const salta = stato.piante && ultimoConta !== null && n !== ultimoConta;
  if (stato.piante) ultimoConta = n;
  const nuovaSezione = ultimaSezione !== null && r.sezione !== ultimaSezione;
  ultimaSezione = r.sezione;
  return html`
    <main class="vista ${v.conTabbar ? "" : "senza-tabbar"}" id="vista">${contenuto}</main>
    ${v.conTabbar ? html`
      <div class="velo" aria-hidden="true"></div>
      <nav class="tabbar" aria-label="Sezioni">
        ${SEZIONI.map((nome) => html`
          <a class="tab ${r.sezione === nome && nuovaSezione ? "appena" : ""}" href="#/${nome}" aria-label="${TAB[nome].etichetta}" ${r.sezione === nome ? html`aria-current="page"` : ""}>
            ${icona(TAB[nome].icona, 22)}
            ${nome === "oggi" && n ? html`<span class="tab-conta ${salta ? "salta" : ""}" aria-label="${n} piante con qualcosa da fare">${n}</span>` : ""}
          </a>`)}
        <a class="tab" href="#/nuova" aria-label="Aggiungi una pianta">${icona("plus", 24)}</a>
        <button class="tab" type="button" data-azione="account" aria-label="Account e promemoria">${icona("user", 22)}</button>
      </nav>` : ""}`;
}

function senzaConfigurazione() {
  return html`
    <main class="accesso">
      <div class="accesso-testa">
        <h1>Piante</h1>
        <p>Manca la configurazione di Supabase. Imposta le Variables <b>SUPABASE_URL</b> e
        <b>SUPABASE_PUBLISHABLE_KEY</b> nel repo GitHub e rilancia il deploy (in locale: <b>.env.local</b>).</p>
      </div>
    </main>`;
}

let datiVisti = false;

/**
 * Ridisegna la vista giusta. La pagina di accesso non si ridisegna da sola, per non perdere quello che stai
 * scrivendo; nelle altre il campo attivo riprende il fuoco e il cursore dov'erano.
 */
function disegna() {
  let nome, contenuto;
  if (!configurato) [nome, contenuto] = ["config", senzaConfigurazione()];
  else if (!stato.pronto) [nome, contenuto] = ["attesa", ""];
  else if (!stato.sessione) {
    if (app.dataset.vista === "accesso") return;
    [nome, contenuto] = ["accesso", accesso.render()];
  } else [nome, contenuto] = ["app", guscio()];

  const attivo = document.activeElement;
  const chiave = attivo?.dataset?.input ? `[data-input="${attivo.dataset.input}"]${attivo.dataset.campo ? `[data-campo="${attivo.dataset.campo}"]` : ""}` : null;
  let selezione = null;
  try { selezione = chiave ? [attivo.selectionStart, attivo.selectionEnd] : null; } catch { /* date e number */ }

  // Primo arrivo dei dati: anche questo è un'entrata.
  if (nome === "app" && stato.piante && !datiVisti) {
    datiVisti = true;
    segnaEntrata();
  }
  if (!stato.piante) datiVisti = false;
  const trascorso = performance.now() - entrataDa;
  if (trascorso < ENTRATA_MS) {
    app.dataset.entra = versoEntrata;
    app.style.setProperty("--gia", `${-Math.round(trascorso)}ms`);
  } else delete app.dataset.entra;

  app.dataset.vista = nome;
  app.innerHTML = String(contenuto);

  if (chiave) {
    const el = app.querySelector(chiave);
    if (el) {
      el.focus({ preventScroll: true });
      try { if (selezione) el.setSelectionRange(...selezione); } catch { /* campi senza selezione */ }
    }
  }
  if (nome === "app") idrataFoto(app);
  if (nome === "app" && stato.piante) aggiornaBadge(quanteDaFare());
}

// ───────────────────────────────────────── azioni
let caricamentoPartenza = false;

const AZIONI = {
  ...cure.azioni,
  ...oggi.azioni,
  ...stanza.azioni,
  ...pianta.azioni,
  ...editor.azioni,
  ...account.azioni,
  account: account.apri,
  "chiudi-foglio": chiudiFoglio,
  "diario-scegli": (el) => { fotoPer = el.dataset.id; sceltaFoto.click(); },
  riprova: () => caricaTutto(),
  partenza: async (el) => {
    if (caricamentoPartenza || stato.piante?.length) return;
    caricamentoPartenza = true;
    el.disabled = true;
    try {
      const nuove = await aggiungiPiante(PIANTE_DI_PARTENZA);
      toast(`${nuove.length} piante aggiunte. Sistema le stanze in Casa.`, { durata: 4500 });
    } catch (e) {
      console.error("partenza", e);
      el.disabled = false;
      toast("Non sono riuscito ad aggiungerle. Riprova.");
    } finally {
      caricamentoPartenza = false;
    }
  },
  esci: async () => {
    chiudiFoglio();
    aggiornaBadge(0);
    await esci();
  },
};

const INPUT = { ...editor.input, ...pianta.input };

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-azione]");
  if (!el || el.disabled) return;
  const azione = AZIONI[el.dataset.azione];
  if (!azione) return;
  e.preventDefault();
  azione(el, e);
});

document.addEventListener("input", (e) => {
  const f = INPUT[e.target.dataset?.input];
  if (f) f(e.target);
});

// Campo Specie dell'editor: l'elenco dei suggerimenti si apre e si chiude con il fuoco. Toccare un suggerimento
// non toglie il fuoco al campo (preventDefault), così su iPhone la tastiera non si chiude a metà tocco.
document.addEventListener("focusin", (e) => { if (e.target.id === "specie") editor.campoSpecie.apri(); });
document.addEventListener("focusout", (e) => { if (e.target.id === "specie") editor.campoSpecie.chiudi(); });
document.addEventListener("keydown", (e) => { if (e.target.id === "specie") editor.campoSpecie.tasto(e); });
for (const tipo of ["pointerdown", "mousedown"]) {
  document.addEventListener(tipo, (e) => { if (e.target.closest?.(".suggerimenti")) e.preventDefault(); });
}

document.addEventListener("change", (e) => {
  if (e.target.dataset?.azioneChange === "ora") account.cambiaOra(e.target);
  if (e.target.dataset?.spunta) stanza.aggiornaConteggio();
});

document.addEventListener("submit", (e) => {
  e.preventDefault();
  if (e.target.id === "form-accesso") accesso.invia(e.target);
});

sceltaFoto.addEventListener("change", () => {
  const file = sceltaFoto.files?.[0];
  sceltaFoto.value = ""; // così si può scegliere di nuovo lo stesso file
  if (file && fotoPer) pianta.fotoScelta(fotoPer, file);
});

// ───────────────────────────────────────── cambio pagina
// La foto della pianta vola dalla riga (o dalla carta) al ritratto della scheda, e ritorno: View Transitions con
// un nome condiviso, messo solo sulle due foto giuste e solo se si vedono.
const chiaveRotta = (r) => `${r.nome}/${r.param.join("/")}`;
const scorrimenti = new Map(); // pagina → dove eri arrivato, per ritrovarlo tornando indietro

function nomina(el) {
  for (const x of document.querySelectorAll("[data-vola]")) {
    x.style.viewTransitionName = "";
    delete x.dataset.vola;
  }
  if (!el) return;
  const r = el.getBoundingClientRect();
  if (r.bottom < 0 || r.top > innerHeight) return; // fuori schermo: niente volo
  el.style.viewTransitionName = "foto-pianta";
  el.dataset.vola = "";
}
const fotoInElenco = (id) => app.querySelector(`a[href="#/pianta/${id}"] .foto`);
const fotoRitratto = () => app.querySelector(".ritratto-cornice");

/** Aspetta (poco) che la foto della nuova pagina sia pronta, così il volo non atterra su un riquadro vuoto. */
function fotoPronta(img) {
  if (!img || img.complete) return Promise.resolve();
  return Promise.race([img.decode().catch(() => {}), new Promise((ok) => setTimeout(ok, 160))]);
}

let rottaPrecedente = rotta();
window.addEventListener("hashchange", () => {
  normalizza();
  const r = rotta();
  const da = rottaPrecedente;
  // Uscendo da un form senza salvare la bozza si butta: rientrando si riparte da com'era.
  const prima = vistaPer(da);
  const stessaPagina = prima === vistaPer(r) && chiaveRotta(r) === chiaveRotta(da);
  if (prima.abbandona && !stessaPagina) prima.abbandona();
  rottaPrecedente = r;
  scorrimenti.set(chiaveRotta(da), scrollY);
  chiudiFoglio();

  const pd = profondita(da);
  const pr = profondita(r);
  const tipo = pr > pd ? "avanti" : pr < pd ? "indietro" : "tab";
  // Tornando indietro ritrovi il punto dell'elenco; andando avanti o cambiando tab si parte dall'alto.
  const y = tipo === "indietro" ? scorrimenti.get(chiaveRotta(r)) || 0 : 0;

  // Foto che vola: elenco → scheda (andata) o scheda → elenco (ritorno).
  const versoScheda = r.nome === "pianta" && !r.param[1] && da.nome !== "pianta";
  const dallaScheda = da.nome === "pianta" && !da.param[1] && r.nome !== "pianta";
  nomina(versoScheda ? fotoInElenco(r.param[0]) : dallaScheda ? fotoRitratto() : null);

  transizione(tipo, async () => {
    segnaEntrata(tipo === "tab" ? "su" : tipo);
    disegna();
    window.scrollTo(0, y);
    if (versoScheda) {
      nomina(fotoRitratto());
      await fotoPronta(app.querySelector(".ritratto-foto img"));
    } else if (dallaScheda) nomina(fotoInElenco(da.param[0]));
    else nomina(null);
    document.querySelector("#vista h1")?.focus({ preventScroll: true });
  });
});

// Appena il dito tocca una pianta, la foto grande della scheda comincia a scaricarsi.
document.addEventListener("pointerdown", (e) => {
  const a = e.target.closest?.('a[href^="#/pianta/"]');
  const id = a?.getAttribute("href").split("/")[2];
  const p = id && stato.piante?.find((x) => x.id === id);
  const src = p && fotoSpecie(specieDi(p), "copertina");
  if (src) new Image().src = src;
}, { passive: true });

// Swipe orizzontale sulla griglia del calendario: mese dopo o prima. (Il listener sul documento abilita anche
// :active su iOS, che senza un touchstart non mostra lo stato premuto.)
let tocco = null;
document.addEventListener("touchstart", (e) => {
  tocco = e.touches.length === 1 && e.target.closest?.(".cal-griglia")
    ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
    : null;
}, { passive: true });
document.addEventListener("touchend", (e) => {
  if (!tocco) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - tocco.x;
  const dy = t.clientY - tocco.y;
  tocco = null;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) oggi.scorriMese(dx < 0 ? 1 : -1);
}, { passive: true });

// Tornando sull'app (dalla notifica o dopo ore): giorno aggiornato e dati riletti, se sono vecchi di qualche minuto.
let ultimoCaricamento = 0;
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible" || !stato.sessione) return;
  if (Date.now() - ultimoCaricamento > 5 * 60_000) ricarica();
  else aggiorna({});
  verificaNotifiche();
});

function ricarica() {
  ultimoCaricamento = Date.now();
  return caricaTutto();
}

// ───────────────────────────────────────── avvio
async function avvia() {
  normalizza();
  rottaPrecedente = rotta();
  preparaFoglio();
  ascolta(disegna);
  ascolta(account.ridisegna);
  if (!configurato) return disegna();

  const { data } = await sb.auth.getSession();
  aggiorna({ pronto: true, sessione: data.session });
  if (data.session) {
    ricarica();
    verificaNotifiche();
  }

  sb.auth.onAuthStateChange((_evento, sessione) => {
    const prima = stato.sessione?.user?.id;
    const dopo = sessione?.user?.id;
    // Fuori dal callback: supabase-js sconsiglia di chiamare altre API mentre notifica l'evento.
    setTimeout(() => {
      aggiorna({ sessione });
      if (!dopo) azzeraDati();
      else if (dopo !== prima) {
        ricarica();
        verificaNotifiche();
      }
    }, 0);
  });
}

avvia();
