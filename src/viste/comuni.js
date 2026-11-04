import { html } from "../ui/html.js";
import { icona } from "../ui/icone.js";
import { quanto, traQuanto } from "../tempo.js";

/** Titolo della sezione con il pulsante Account a destra. */
export function testata(titolo, sotto = "") {
  return html`
    <header class="testata">
      <div>
        <h1 tabindex="-1">${titolo}</h1>
        ${sotto ? html`<p class="sotto">${sotto}</p>` : ""}
      </div>
      <button class="icona-btn" type="button" data-azione="account" aria-label="Account e promemoria">${icona("user")}</button>
    </header>`;
}

/** Barra delle pagine interne: indietro a sinistra, un'azione a destra. */
export function barra({ indietro, href, azione = "", titolo = "" }) {
  return html`
    <header class="barra">
      <a class="indietro" href="${href}">${icona("chevron-left", 22)}<span>${indietro}</span></a>
      ${titolo ? html`<h1 class="barra-titolo" tabindex="-1">${titolo}</h1>` : html`<span aria-hidden="true"></span>`}
      <div class="barra-azione">${azione}</div>
    </header>`;
}

/** Stato vuoto: dice cosa fare, con al massimo un paio di azioni. */
export function vuoto({ icona: ic, titolo, testo, azione }) {
  return html`
    <section class="vuoto">
      <div class="vuoto-icona">${icona(ic, 30, 1.75)}</div>
      <h2>${titolo}</h2>
      <p>${testo}</p>
      ${azione || ""}
    </section>`;
}

export function avviso(testo) {
  return html`
    <div class="avviso" role="alert">
      ${icona("alert", 18)}
      <span>${testo}</span>
      <button class="link" type="button" data-azione="riprova">Riprova</button>
    </div>`;
}

export const contaPiante = (n) => (n === 1 ? "1 pianta" : `${n} piante`);

const idro = (p) => p.substrato === "idroponica";

/** Parole giuste per terra e idroponica. */
export const verbi = (p) =>
  idro(p)
    ? { fatto: "Rabboccata", fatta: "rabboccata", umida: "Livello ok", icona: "glass" }
    : { fatto: "Bagnata", fatta: "bagnata", umida: "Ancora umida", icona: "droplet" };

/** Una riga di stato: "Bagnata 3 giorni fa · controllo tra 4 giorni" o "Da controllare da 2 giorni". */
export function statoBreve(p, s) {
  if (s.daControllare) return s.ritardo === 0 ? "Da controllare oggi" : `Da controllare ${traQuanto(-s.ritardo)}`;
  const v = verbi(p);
  const ultima = s.bagnata ? `${v.fatto} ${quanto(s.bagnata)}` : "Mai segnata";
  return `${ultima} · controllo ${traQuanto(s.mancano)}`;
}

/** Pulsanti Bagnata / Ancora umida per una pianta. */
export function azioniCura(p, { compatte = false } = {}) {
  const v = verbi(p);
  return html`
    <div class="azioni-cura ${compatte ? "compatte" : ""}">
      <button class="btn primario" type="button" data-azione="bagnata" data-id="${p.id}">${icona(v.icona, 18)}${v.fatto}</button>
      <button class="btn" type="button" data-azione="umida" data-id="${p.id}">${icona("clock", 18)}${v.umida}</button>
    </div>`;
}

/** Descrizione corta: tipo, vaso, idroponica. */
export function dettagli(p, { conStanza = false } = {}) {
  const tipo = p.tipo && !p.nome.toLowerCase().includes(p.tipo.toLowerCase()) ? p.tipo : null;
  return [conStanza ? p.stanza : null, tipo, p.vaso, idro(p) ? "idroponica" : null].filter(Boolean).join(" · ");
}
