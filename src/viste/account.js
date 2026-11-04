import { html } from "../ui/html.js";
import { icona } from "../ui/icone.js";
import { stato, tolte, trovaPianta } from "../stato.js";
import { salvaOra, archiviaPianta, eliminaPianta } from "../dati.js";
import { attivaNotifiche, disattivaNotifiche, inviaProva, spiegazione } from "../notifiche.js";
import { apriFoglio, foglioAperto, toast } from "../ui/avvisi.js";
import { VERSIONE } from "../config.js";

// Foglio Account: promemoria (notifiche su questo dispositivo e ora), piante tolte, uscita.

let occupato = null; // azione in corso nel foglio: "attiva", "prova", "disattiva"

export function render(s) {
  const archivio = tolte();
  return html`
    <div class="maniglia" aria-hidden="true"></div>
    <div class="foglio-testa">
      <h2 id="foglio-titolo">Account</h2>
      <button class="icona-btn" type="button" data-azione="chiudi-foglio" aria-label="Chiudi">${icona("x")}</button>
    </div>

    <section class="foglio-sezione">
      <h3>Promemoria</h3>
      ${notifiche(s)}
      <label class="riga-campo">
        <span>Ogni giorno alle</span>
        <select data-azione-change="ora" aria-label="Ora del promemoria">
          ${Array.from({ length: 17 }, (_, i) => i + 6).map((h) => html`
            <option value="${h}" ${h === s.ora ? "selected" : ""}>${String(h).padStart(2, "0")}:00</option>`)}
        </select>
      </label>
      <p class="aiuto">Una notifica sola, solo se c'è una pianta da controllare o un concime da dare.</p>
    </section>

    ${archivio.length ? html`
      <section class="foglio-sezione">
        <h3>Piante tolte</h3>
        <ul class="elenco">${archivio.map((p) => html`
          <li class="riga-tolta">
            <span class="riga-testo"><span class="riga-nome">${p.nome}</span><span class="riga-meta">${p.stanza}</span></span>
            <button class="btn piccolo" type="button" data-azione="rimetti-da-foglio" data-id="${p.id}">Rimetti</button>
            <button class="icona-btn piccola" type="button" data-azione="elimina-pianta" data-id="${p.id}"
              aria-label="Elimina per sempre ${p.nome}">${icona("trash", 16)}</button>
          </li>`)}
        </ul>
      </section>` : ""}

    <dl class="righe">
      <div><dt>Email</dt><dd>${s.sessione?.user?.email || ""}</dd></div>
      <div><dt>Versione</dt><dd>${VERSIONE}</dd></div>
    </dl>
    <button class="btn largo" type="button" data-azione="esci">${icona("logout")}Esci</button>`;
}

function notifiche(s) {
  const busy = (nome) => (occupato === nome ? html`aria-busy="true" disabled` : occupato ? "disabled" : "");
  if (s.notifiche === "attive") {
    return html`
      <p class="stato-notifiche attive">${icona("bell", 18)}<span>Notifiche attive su questo dispositivo.</span></p>
      <div class="azioni-cura">
        <button class="btn" type="button" data-azione="prova-notifica" ${busy("prova")}>${occupato === "prova" ? "Invio…" : "Invia una prova"}</button>
        <button class="btn" type="button" data-azione="disattiva-notifiche" ${busy("disattiva")}>Disattiva</button>
      </div>`;
  }
  if (s.notifiche === "spente") {
    return html`
      <p class="stato-notifiche">${icona("bell", 18)}<span>Notifiche spente su questo dispositivo.</span></p>
      <button class="btn primario largo" type="button" data-azione="attiva-notifiche" ${busy("attiva")}>
        ${occupato === "attiva" ? "Attivo…" : "Attiva le notifiche"}</button>`;
  }
  if (s.notifiche === "verifico") return html`<p class="stato-notifiche">Controllo le notifiche…</p>`;
  return html`<p class="stato-notifiche">${icona("alert", 18)}<span>${spiegazione(s.notifiche)}</span></p>`;
}

export const apri = () => apriFoglio(render(stato), "account");
/** Ridisegna il foglio se è aperto sull'account (non sopra una conferma). */
export const ridisegna = () => { if (foglioAperto("account")) apri(); };

async function conOccupato(nome, f) {
  if (occupato) return;
  occupato = nome;
  ridisegna();
  try {
    await f();
  } finally {
    occupato = null;
    ridisegna();
  }
}

export const azioni = {
  "attiva-notifiche": () => conOccupato("attiva", async () => {
    try {
      await attivaNotifiche();
      toast("Notifiche attive. Prova a mandarne una.");
    } catch (e) {
      console.error("attiva notifiche", e);
      toast(e.message || "Non sono riuscito ad attivarle.", { durata: 6000 });
    }
  }),
  "disattiva-notifiche": () => conOccupato("disattiva", async () => {
    try {
      await disattivaNotifiche();
      toast("Notifiche disattivate su questo dispositivo.");
    } catch (e) {
      console.error("disattiva notifiche", e);
      toast("Non sono riuscito a disattivarle. Riprova.");
    }
  }),
  "prova-notifica": () => conOccupato("prova", async () => {
    try {
      const r = await inviaProva();
      toast(r.inviate === 1 ? "Notifica inviata: arriva tra pochi secondi." : `Notifica inviata a ${r.inviate} dispositivi.`);
    } catch (e) {
      console.error("prova notifica", e);
      toast(e.message, { durata: 6000 });
    }
  }),
  "rimetti-da-foglio": async (el) => {
    const p = trovaPianta(el.dataset.id);
    if (!p) return;
    try {
      await archiviaPianta(p, false);
      toast(`${p.nome} è di nuovo in casa.`);
    } catch (e) {
      console.error("rimetti", e);
      toast("Non ci sono riuscito. Riprova.");
    }
  },
  "elimina-pianta": (el) => {
    const p = trovaPianta(el.dataset.id);
    if (!p) return;
    apriFoglio(html`
      <div class="maniglia" aria-hidden="true"></div>
      <div class="foglio-testa"><h2 id="foglio-titolo">Eliminare ${p.nome}?</h2></div>
      <p class="foglio-testo">Sparisce per sempre, con tutto il suo storico. Non si può annullare.</p>
      <div class="foglio-azioni">
        <button class="btn" type="button" data-azione="account">Annulla</button>
        <button class="btn" type="button" data-azione="conferma-elimina" data-id="${p.id}">${icona("trash", 18)}Elimina</button>
      </div>`, "conferma");
  },
  "conferma-elimina": async (el) => {
    const p = trovaPianta(el.dataset.id);
    if (!p) return;
    el.disabled = true;
    try {
      await eliminaPianta(p);
      toast(`${p.nome} eliminata.`);
      apri();
    } catch (e) {
      console.error("elimina", e);
      el.disabled = false;
      toast("Non sono riuscito a eliminarla. Riprova.");
    }
  },
};

/** Cambio dell'ora (select): si salva subito. */
export async function cambiaOra(el) {
  const ora = Number(el.value);
  const prima = stato.ora;
  try {
    await salvaOra(ora);
    toast(`Promemoria alle ${String(ora).padStart(2, "0")}:00.`);
  } catch (e) {
    console.error("ora", e);
    el.value = String(prima);
    toast("Non sono riuscito a salvare l'ora. Riprova.");
  }
}
