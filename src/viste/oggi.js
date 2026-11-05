import { html } from "../ui/html.js";
import { icona } from "../ui/icone.js";
import { aggiorna, inOrdine, oggiDaFare } from "../stato.js";
import { eventi, settimane } from "../calendario.js";
import { giornoLungo, quanto, traQuanto } from "../tempo.js";
import { spiegazione } from "../notifiche.js";
import { vibra, festa as coriandoli } from "../ui/effetti.js";
import { PIANTE_DI_PARTENZA } from "../partenza.js";
import { testata, vuoto, azioniCura, verbi, contaPiante, miniatura, foto, regolaCiclo } from "./comuni.js";

export const titolo = "Calendario";
export const conTabbar = true;

const GIORNI_SETTIMANA = ["L", "M", "M", "G", "V", "S", "D"];
const NOMI_MESI = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

// Mese mostrato e giorno scelto: restano finché non cambi pagina.
let mese = null;   // "AAAA-MM"
let scelto = null; // "AAAA-MM-GG"
// Animazioni da fare una volta sola, nel ridisegno subito dopo il tocco (i ridisegni successivi non le ripetono).
let scorre = null;          // "avanti" · "indietro": il mese che entra
let appenaScelto = false;   // il giorno toccato fa pop
let primaDaFare = null;     // quante cose c'erano da fare oggi al disegno precedente: se diventano zero, festa

const saluto = () => {
  const h = new Date().getHours();
  return h < 13 ? "Buongiorno" : h < 18 ? "Buon pomeriggio" : "Buonasera";
};

export function abbandona() {
  mese = null;
  scelto = null;
  primaDaFare = null;
}

/** Mese dopo (1) o prima (-1): dalle frecce e dallo swipe sulla griglia. */
export function scorriMese(delta) {
  if (!mese) return;
  const [a, m] = mese.split("-").map(Number);
  mese = new Date(Date.UTC(a, m - 1 + delta, 1)).toISOString().slice(0, 7);
  scorre = delta > 0 ? "avanti" : "indietro";
  vibra();
  aggiorna({});
  scorre = null;
}

export function render(s, { avviso = "" } = {}) {
  const sotto = `${saluto()} · ${giornoLungo(s.oggi)}`;
  if (s.piante == null) return html`${testata(titolo, s.caricamento ? "Carico…" : sotto)}${avviso}`;

  const tutte = inOrdine();
  if (!tutte.length) return html`${testata(titolo, sotto)}${avviso}${benvenuto(s)}`;

  mese ||= s.oggi.slice(0, 7);
  scelto ||= s.oggi;
  const [anno, m] = mese.split("-").map(Number);
  const griglia = settimane(anno, m);
  const giorniMese = griglia.flat().filter(Boolean);
  const ev = eventi(s, giorniMese[0], giorniMese.at(-1), s.oggi);
  const oggiDa = oggiDaFare();

  return html`
    ${testata(titolo, sotto)}
    ${avviso}
    ${invitoNotifiche(s)}
    <section class="calendario pannello">
      <div class="cal-testa">
        <button class="icona-btn piccola" type="button" data-azione="cal-mese" data-delta="-1" aria-label="Mese prima">${icona("chevron-left", 18)}</button>
        <h2>${NOMI_MESI[m - 1]} ${anno}</h2>
        <button class="icona-btn piccola" type="button" data-azione="cal-mese" data-delta="1" aria-label="Mese dopo">${icona("chevron-right", 18)}</button>
      </div>
      <div class="cal-griglia ${scorre ? `scorre-${scorre}` : ""}" role="grid">
        ${GIORNI_SETTIMANA.map((g) => html`<span class="cal-intestazione">${g}</span>`)}
        ${griglia.flat().map((g) => {
          if (!g) return html`<span></span>`;
          const e = ev.get(g);
          const oggiQui = g === s.oggi;
          const acqua = oggiQui ? oggiDa.acqua.length : e?.acqua.length || 0;
          const conc = oggiQui ? oggiDa.concime.length : e?.concime.length || 0;
          const fatte = e?.fatte.length || 0;
          return html`
            <button class="cal-giorno ${oggiQui ? "oggi" : ""} ${g === scelto ? `scelto${appenaScelto ? " appena" : ""}` : ""} ${g < s.oggi ? "passato" : ""}"
              type="button" data-azione="cal-giorno" data-giorno="${g}" aria-label="${giornoLungo(g)}" aria-pressed="${String(g === scelto)}">
              <span class="cal-numero">${Number(g.slice(8))}</span>
              <span class="cal-punti">
                ${acqua ? html`<i class="punto acqua"></i>` : ""}${conc ? html`<i class="punto concime"></i>` : ""}${fatte && !acqua && !conc ? html`<i class="punto fatto"></i>` : ""}
              </span>
            </button>`;
        })}
      </div>
      <div class="cal-legenda"><span><i class="punto acqua"></i>Acqua</span><span><i class="punto concime"></i>Concime</span><span><i class="punto fatto"></i>Fatto</span></div>
    </section>
    <div class="cal-dettaglio ${appenaScelto ? "appare" : ""}">
      ${scelto === s.oggi ? oggi(s, tutte, oggiDa) : giorno(s, scelto, eventi(s, scelto, scelto, s.oggi).get(scelto))}
    </div>`;
}

/** Il giorno di oggi: le carte da fare, come prima. Quando sistemi l'ultima, festa. */
function oggi(s, tutte, { acqua, concime }) {
  const n = acqua.length + concime.length;
  const festa = primaDaFare > 0 && n === 0;
  primaDaFare = n;
  if (festa) requestAnimationFrame(() => coriandoli(document.querySelector("#app .a-posto .vuoto-icona")));
  return html`
    ${acqua.length ? html`
      <h2 class="titoletto">Da controllare oggi <span class="conta">${acqua.length}</span></h2>
      <ul class="carte">${acqua.map(cartaAcqua)}</ul>` : ""}
    ${concime.length ? html`
      <h2 class="titoletto">Da concimare oggi <span class="conta">${concime.length}</span></h2>
      <ul class="carte">${concime.map(cartaConcime)}</ul>` : ""}
    ${!n ? tuttoAPosto(tutte.find((x) => Number.isFinite(x.stato.mancano)), festa) : ""}`;
}

/** Un altro giorno: cosa è previsto (futuro) o cosa hai fatto (passato). */
function giorno(s, g, e) {
  const futuro = g > s.oggi;
  const righe = [];
  if (e) {
    for (const p of e.acqua) righe.push({ p, testo: p.substrato === "idroponica" ? "Controllo del livello" : "Controllo dell'acqua", icona: verbi(p).icona });
    for (const { pianta: p, ciclo: c } of e.concime) righe.push({ p, testo: `Concime: ${c.prodotto}`, icona: "flask" });
    for (const c of e.fatte) {
      const v = verbi(c.pianta);
      const testo = c.tipo === "bagnata" ? v.fatto : c.tipo === "controllata" ? v.umida : `Concimata · ${c.prodotto}`;
      righe.push({ p: c.pianta, testo, icona: c.tipo === "concimata" ? "flask" : c.tipo === "bagnata" ? v.icona : "clock" });
    }
  }
  return html`
    <h2 class="titoletto">${giornoLungo(g)}</h2>
    ${righe.length ? html`
      <div class="pannello">
        <ul class="elenco">${righe.map((r) => html`
          <li>
            <a class="riga" href="#/pianta/${r.p.id}">
              ${miniatura(r.p)}
              <span class="riga-testo">
                <span class="riga-nome">${r.p.nome}</span>
                <span class="riga-meta">${r.testo}</span>
              </span>
              <span class="storico-icona ${r.icona === "flask" ? "concimata" : "bagnata"}">${icona(r.icona, 16)}</span>
            </a>
          </li>`)}
        </ul>
      </div>
      ${futuro ? html`<p class="nota">Previsioni: si spostano se bagni o concimi prima o dopo.</p>` : ""}` : html`
      <p class="nota">${futuro ? "Niente in programma." : "Niente di segnato."}</p>`}`;
}

export const azioni = {
  "cal-mese": (el) => scorriMese(Number(el.dataset.delta)),
  "cal-giorno": (el) => {
    if (scelto === el.dataset.giorno) return;
    scelto = el.dataset.giorno;
    appenaScelto = true;
    vibra();
    aggiorna({});
    appenaScelto = false;
  },
};

/** Foto della specie con il nome in un'etichetta di vetro e la freccia verso la scheda. */
function testaCarta(p, meta) {
  return html`
    <a class="carta-foto" href="#/pianta/${p.id}" aria-label="Apri ${p.nome}">
      ${foto(p, "carta")}
      <span class="etichetta-foto">
        <span class="riga-testo">
          <span class="etichetta-nome">${p.nome}</span>
          <span class="riga-meta">${meta}</span>
        </span>
        <span class="icona-btn accento" aria-hidden="true">${icona("arrow-up-right", 20)}</span>
      </span>
    </a>`;
}

function cartaAcqua({ pianta: p, stato: st, concime }) {
  const v = verbi(p);
  const ultima = st.bagnata ? `${v.fatta} ${quanto(st.bagnata)}` : "mai segnata";
  const consiglio = p.note || (p.substrato === "idroponica"
    ? "Controlla il livello dell'acqua e rabbocca se serve."
    : "Tocca il terriccio: se i primi centimetri sono asciutti, bagnala.");
  return html`
    <li class="carta">
      ${testaCarta(p, html`${p.stanza} · ${ultima}${st.ritardo ? html` · <b class="in-ritardo">${st.ritardo === 1 ? "da ieri" : `da ${st.ritardo} giorni`}</b>` : ""}`)}
      <div class="carta-corpo">
        <p class="carta-nota">${consiglio}</p>
        ${concime.length ? html`
          <p class="carta-concime">${icona("flask", 16)}<span>Nell'acqua: ${concime.map((c) => c.prodotto).join(", ")}${concime.some((c) => c.note) ? html` <span class="riga-meta">(${concime.map((c) => c.note).filter(Boolean).join("; ")})</span>` : ""}</span></p>` : ""}
        ${azioniCura(p, { concime })}
      </div>
    </li>`;
}

function cartaConcime({ pianta: p, ciclo: c, stato: st }) {
  const ultima = st.giorniDa == null ? "mai segnato" : `l'ultima volta ${quanto(st.fatta)}`;
  return html`
    <li class="carta">
      ${testaCarta(p, html`${p.stanza} · ${ultima}`)}
      <div class="carta-corpo">
        <p class="carta-concime forte">${icona("flask", 16)}<span><b>${c.prodotto}</b> <span class="riga-meta">${regolaCiclo(c, p)}</span></span></p>
        ${c.note ? html`<p class="carta-nota">${c.note}</p>` : ""}
        <button class="btn primario largo" type="button" data-azione="concimata" data-id="${p.id}" data-ciclo="${c.id}">${icona("check", 18)}Concimata</button>
      </div>
    </li>`;
}

function tuttoAPosto(prima, festa = false) {
  const prossima = prima ? `Prossimo controllo: ${prima.pianta.nome}, ${traQuanto(prima.stato.mancano)}.` : "";
  return html`
    <section class="a-posto ${festa ? "festa" : ""}">
      <div class="vuoto-icona">${icona("check", 30, 2.2)}</div>
      <h2>Tutto a posto</h2>
      <p>Niente da bagnare né da concimare oggi. ${prossima}</p>
    </section>`;
}

function invitoNotifiche(s) {
  if (s.notifiche === "attive" || s.notifiche === "verifico" || s.notifiche === "non-supportate") return "";
  const testo = s.notifiche === "spente"
    ? "Attiva i promemoria: ogni mattina ti avviso se c'è una pianta da controllare o da concimare."
    : spiegazione(s.notifiche);
  return html`
    <button class="invito" type="button" data-azione="account">
      ${icona("bell", 20)}<span>${testo}</span>${icona("chevron-right", 18)}
    </button>`;
}

function benvenuto(s) {
  return vuoto({
    icona: "sprout",
    titolo: "Nessuna pianta, per ora",
    testo: `Aggiungile una alla volta, oppure parti dalle ${contaPiante(PIANTE_DI_PARTENZA.length)} che conosco già, con i loro concimi: poi sistemi stanze e intervalli.`,
    azione: html`
      <div class="vuoto-azioni">
        <button class="btn primario" type="button" data-azione="partenza" ${s.caricamento ? "disabled" : ""}>${icona("sprout", 18)}Carica le mie piante</button>
        <a class="btn" href="#/nuova">${icona("plus", 18)}Aggiungi una pianta</a>
      </div>`,
  });
}
