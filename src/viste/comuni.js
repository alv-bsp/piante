import { html } from "../ui/html.js";
import { icona } from "../ui/icone.js";
import { quanto, traQuanto } from "../tempo.js";
import { MESI } from "../../supabase/functions/_shared/scadenze.js";
import { specieDi, fotoSpecie } from "../specie.js";

/** Titolo grande della sezione, con una riga piccola sopra e un'azione facoltativa a destra. */
export function testata(titolo, sotto = "", azione = "") {
  return html`
    <header class="testata">
      <div>
        ${sotto ? html`<p class="sotto">${sotto}</p>` : ""}
        <h1>${titolo}</h1>
      </div>
      ${azione}
    </header>`;
}

/** Barra delle pagine interne: indietro a sinistra, un'azione a destra. */
export function barra({ indietro, href, azione = "", titolo = "" }) {
  return html`
    <header class="barra">
      <a class="indietro" href="${href}" aria-label="${indietro}"><span class="icona-btn" aria-hidden="true">${icona("chevron-left", 20)}</span></a>
      ${titolo ? html`<h1 class="barra-titolo">${titolo}</h1>` : html`<span aria-hidden="true"></span>`}
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
  if (s.automatica) return "Irrigazione automatica";
  if (s.daControllare) return s.ritardo === 0 ? "Da controllare oggi" : `Da controllare ${traQuanto(-s.ritardo)}`;
  const v = verbi(p);
  const ultima = s.bagnata ? `${v.fatto} ${quanto(s.bagnata)}` : "Mai segnata";
  return `${ultima} · controllo ${traQuanto(s.mancano)}`;
}

/**
 * Pulsanti per una pianta da controllare. Se c'è un concime da sciogliere nell'acqua, il pulsante principale è
 * "Bagnata con concime" e sotto c'è "Solo acqua".
 */
export function azioniCura(p, { concime = [] } = {}) {
  const v = verbi(p);
  if (concime.length) {
    return html`
      <div class="azioni-cura">
        <button class="btn primario" type="button" data-azione="bagnata-concime" data-id="${p.id}">${icona("flask", 18)}Con concime</button>
        <button class="btn" type="button" data-azione="umida" data-id="${p.id}">${icona("clock", 18)}${v.umida}</button>
      </div>
      <button class="link solo-acqua" type="button" data-azione="bagnata" data-id="${p.id}">Solo acqua, senza concime</button>`;
  }
  return html`
    <div class="azioni-cura">
      <button class="btn primario" type="button" data-azione="bagnata" data-id="${p.id}">${icona(v.icona, 18)}${v.fatto}</button>
      <button class="btn" type="button" data-azione="umida" data-id="${p.id}">${icona("clock", 18)}${v.umida}</button>
    </div>`;
}

/** "marzo–settembre", "tutto l'anno" */
export const mesiCiclo = (c) =>
  c.dal_mese === c.al_mese % 12 + 1 ? "tutto l'anno" : c.dal_mese === c.al_mese ? MESI[c.dal_mese - 1] : `${MESI[c.dal_mese - 1]}–${MESI[c.al_mese - 1]}`;

/** "ogni 21 giorni · marzo–settembre · nell'acqua" */
export const regolaCiclo = (c, p) =>
  [`ogni ${c.ogni_giorni} giorni`, mesiCiclo(c), c.con_acqua && !p.irrigazione_automatica ? "nell'acqua" : null].filter(Boolean).join(" · ");

/** Stato di un ciclo in parole: "da dare", "tra 5 giorni", "a riposo fino a marzo". */
export function statoCicloBreve(st) {
  if (!st.attivo) return `A riposo fino a ${st.riprende}`;
  if (st.daFare) return st.mancano === 0 ? "Da dare oggi" : `Da dare ${traQuanto(st.mancano)}`;
  return `Prossimo ${traQuanto(st.mancano)}`;
}

/** Riga di concime per gli elenchi, solo se c'è qualcosa da fare: niente rumore per i cicli a riposo. */
export function concimeBreve(p, cicli) {
  const scaduti = cicli.filter((x) => x.stato.daFare);
  if (!scaduti.length) return "";
  const nell = scaduti.filter((x) => x.ciclo.con_acqua && !p.irrigazione_automatica);
  const aParte = scaduti.filter((x) => !nell.includes(x));
  const parti = [];
  if (aParte.length) parti.push(`Concime da dare: ${aParte.map((x) => x.ciclo.prodotto).join(", ")}`);
  if (nell.length) parti.push(`Concime alla prossima annaffiatura`);
  return parti.join(" · ");
}

/** Descrizione corta: tipo, vaso, idroponica. */
export function dettagli(p, { conStanza = false } = {}) {
  const tipo = p.tipo && !p.nome.toLowerCase().includes(p.tipo.toLowerCase()) ? p.tipo : null;
  return [conStanza ? p.stanza : null, tipo, p.vaso, idro(p) ? "idroponica" : null].filter(Boolean).join(" · ");
}

/**
 * Foto della specie (vedi specie.js), scontornata sul fondo giallo comune. formato: mini, carta, copertina.
 * Specie sconosciuta: niente foto, un germoglio disegnato al suo posto.
 */
export function foto(p, formato = "carta", classe = formato) {
  const specie = specieDi(p);
  const src = fotoSpecie(specie, formato);
  return html`
    <div class="foto ${classe} ${src ? "" : "senza-foto"}">
      ${src
        ? html`<img src="${src}" alt="${specie.nome}" loading="lazy" decoding="async" onerror="this.remove()">`
        : icona("sprout", 24, 1.6)}
    </div>`;
}

/** Miniatura tonda per gli elenchi. */
export const miniatura = (p) => foto(p, "mini");
