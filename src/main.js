import "./stile/tokens.css";
import "./stile/base.css";
import "./stile/componenti.css";

import { configurato } from "./config.js";
import { sb } from "./supabase.js";
import { stato, aggiorna, ascolta, azzeraDati, scadute } from "./stato.js";
import { caricaTutto, aggiungiPiante } from "./dati.js";
import { verificaNotifiche, aggiornaBadge } from "./notifiche.js";
import { idrataFoto } from "./foto.js";
import { PIANTE_DI_PARTENZA } from "./partenza.js";
import { esci } from "./accesso.js";
import { rotta, normalizza, SEZIONI } from "./router.js";
import { html } from "./ui/html.js";
import { icona } from "./ui/icone.js";
import { toast, chiudiFoglio, preparaFoglio } from "./ui/avvisi.js";
import { avviso } from "./viste/comuni.js";
import * as oggi from "./viste/oggi.js";
import * as casa from "./viste/casa.js";
import * as pianta from "./viste/pianta.js";
import * as editor from "./viste/editor.js";
import * as cure from "./viste/cure.js";
import * as accesso from "./viste/accesso.js";
import * as account from "./viste/account.js";

const TAB = {
  oggi: { etichetta: "Oggi", icona: "droplet" },
  casa: { etichetta: "Casa", icona: "house" },
};
const app = document.getElementById("app");
const sceltaFoto = document.getElementById("scegli-foto");

function vistaPer(r) {
  if (r.nome === "nuova") return editor;
  if (r.nome === "pianta") return r.param[1] === "modifica" ? editor : pianta;
  return { oggi, casa }[r.nome];
}

// ───────────────────────────────────────── disegno
function guscio() {
  const r = rotta();
  const v = vistaPer(r);
  const n = stato.piante ? scadute().length : 0;
  document.title = n ? `(${n}) Piante` : "Piante";
  const contenuto = v.render(stato, { rotta: r, avviso: stato.errore ? avviso(stato.errore) : "" });
  return html`
    <main class="vista ${v.conTabbar ? "" : "senza-tabbar"}" id="vista">${contenuto}</main>
    ${v.conTabbar ? html`
      <div class="velo" aria-hidden="true"></div>
      ${v.fab(stato)}
      <nav class="tabbar" aria-label="Sezioni">
        ${SEZIONI.map((nome) => html`
          <a class="tab" href="#/${nome}" ${r.sezione === nome ? html`aria-current="page"` : ""}>
            ${icona(TAB[nome].icona, 22)}<span>${TAB[nome].etichetta}</span>
            ${nome === "oggi" && n ? html`<span class="tab-conta" aria-label="${n} da controllare">${n}</span>` : ""}
          </a>`)}
      </nav>` : ""}`;
}

function senzaConfigurazione() {
  return html`
    <main class="accesso">
      <div class="accesso-testa">
        ${icona("sprout", 48, 1.6)}
        <h1>Piante</h1>
        <p>Manca la configurazione di Supabase. Imposta le Variables <b>SUPABASE_URL</b> e
        <b>SUPABASE_PUBLISHABLE_KEY</b> nel repo GitHub e rilancia il deploy (in locale: <b>.env.local</b>).</p>
      </div>
    </main>`;
}

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
  if (nome === "app" && stato.piante) aggiornaBadge(scadute().length);
}

// ───────────────────────────────────────── azioni
let caricamentoPartenza = false;
let fotoPer = "editor"; // dove va la foto scelta: il modulo, oppure l'id della pianta (foto al volo dalla scheda)

const AZIONI = {
  ...cure.azioni,
  ...pianta.azioni,
  ...editor.azioni,
  ...account.azioni,
  account: account.apri,
  "scegli-foto": () => { fotoPer = "editor"; sceltaFoto.click(); },
  "foto-pianta": (el) => { fotoPer = el.dataset.id; sceltaFoto.click(); },
  "chiudi-foglio": chiudiFoglio,
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

document.addEventListener("change", (e) => {
  if (e.target.dataset?.azioneChange === "ora") account.cambiaOra(e.target);
});

document.addEventListener("submit", (e) => {
  e.preventDefault();
  if (e.target.id === "form-accesso") accesso.invia(e.target);
});

sceltaFoto.addEventListener("change", () => {
  const file = sceltaFoto.files?.[0];
  sceltaFoto.value = ""; // così si può scegliere di nuovo lo stesso file
  if (!file) return;
  if (fotoPer === "editor") editor.cambiaFoto(file);
  else pianta.fotoVeloce(fotoPer, file);
});

let rottaPrecedente = rotta();
window.addEventListener("hashchange", () => {
  normalizza();
  const r = rotta();
  // Uscendo da un form senza salvare la bozza si butta: rientrando si riparte da com'era.
  const prima = vistaPer(rottaPrecedente);
  const stessaPagina = prima === vistaPer(r) && r.nome === rottaPrecedente.nome && r.param.join("/") === rottaPrecedente.param.join("/");
  if (prima.abbandona && !stessaPagina) prima.abbandona();
  rottaPrecedente = r;
  chiudiFoglio();
  disegna();
  window.scrollTo(0, 0);
  document.querySelector("#vista h1")?.focus({ preventScroll: true });
});

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
