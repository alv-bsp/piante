import { html } from "../ui/html.js";
import { icona } from "../ui/icone.js";
import { stato, aggiorna, trovaPianta, statoDi, cicliDi, concimeInAcqua } from "../stato.js";
import { caricaStorico, annullaCure, archiviaPianta } from "../dati.js";
import { sostituisci } from "../router.js";
import { apriFoglio, chiudiFoglio, toast } from "../ui/avvisi.js";
import { giornoBreve, quanto, traQuanto, quando } from "../tempo.js";
import { rinvio } from "../../supabase/functions/_shared/scadenze.js";
import { barra, vuoto, azioniCura, verbi, foto, regolaCiclo, statoCicloBreve } from "./comuni.js";

export const conTabbar = true;

const inArrivo = new Set();
// "Bagnata un altro giorno": aperto e giorno scelto sopravvivono ai ridisegni.
let altro = { id: null, giorno: null };

export function render(s, { rotta, avviso = "" }) {
  const id = rotta.param[0];
  const indietro = barra({ indietro: "Casa", href: "#/casa" });
  if (s.piante == null) return html`${indietro}${avviso}<p class="nota">Carico…</p>`;
  const p = trovaPianta(id);
  if (!p) {
    return html`${indietro}${vuoto({
      icona: "sprout", titolo: "Pianta non trovata", testo: "Forse è stata eliminata.",
      azione: html`<a class="btn" href="#/casa">Torna alla casa</a>`,
    })}`;
  }
  if (!s.storico.has(p.id) && !inArrivo.has(p.id)) {
    inArrivo.add(p.id);
    caricaStorico(p.id).catch((e) => console.error("storico", e)).finally(() => inArrivo.delete(p.id));
  }

  const st = statoDi(p);
  const v = verbi(p);
  const tolta = Boolean(p.archiviata_il);

  return html`
    ${barra({
      indietro: tolta ? "Indietro" : "Casa",
      href: "#/casa",
      azione: tolta ? "" : html`<a class="btn piccolo" href="#/pianta/${p.id}/modifica">${icona("pencil", 16)}Modifica</a>`,
    })}
    ${avviso}
    <article class="scheda">
      <div class="copertina-blocco">
        ${foto(p, "copertina")}
        <div class="etichetta-foto">
          <span class="riga-testo">
            <h1 class="etichetta-nome" tabindex="-1">${p.nome}</h1>
            <span class="riga-meta">${[p.tipo, p.stanza].filter(Boolean).join(" · ")}</span>
          </span>
        </div>
      </div>

      ${tolta
        ? html`<p class="avviso">${icona("archive", 18)}<span>Tolta dalla casa: non compare negli elenchi e non manda promemoria.</span></p>`
        : st.automatica
        ? html`
          <section class="riquadro">
            <p class="riquadro-grande">Irrigazione automatica</p>
            <p class="riquadro-sotto">La bagna Home Assistant: qui niente promemoria per l'acqua, solo per il concime.</p>
          </section>`
        : html`
          <section class="riquadro ${st.daControllare ? "scaduta" : ""}">
            <p class="riquadro-grande">${st.bagnata ? `${v.fatto} ${quanto(st.bagnata)}` : "Mai segnata"}</p>
            <p class="riquadro-sotto">${st.daControllare
              ? (st.ritardo === 0 ? "Da controllare oggi." : `Da controllare ${traQuanto(-st.ritardo)}.`)
              : `Prossimo controllo ${giornoBreve(st.scadenza)}, ${traQuanto(st.mancano)}.`}</p>
            ${azioniCura(p, { concime: st.daControllare ? concimeInAcqua(p) : [] })}
            <details class="altro-giorno" ${altro.id === p.id ? "open" : ""}>
              <summary data-azione="altro-giorno" data-id="${p.id}">${v.fatto} un altro giorno</summary>
              <div class="altro-giorno-riga">
                <input id="altro-giorno" type="date" max="${s.oggi}" value="${(altro.id === p.id && altro.giorno) || s.oggi}"
                  data-input="altro-giorno" aria-label="Giorno">
                <button class="btn piccolo" type="button" data-azione="bagnata-il" data-id="${p.id}">Segna</button>
              </div>
            </details>
          </section>`}

      <dl class="righe pannello">
        <div><dt>Stanza</dt><dd>${p.stanza}</dd></div>
        ${p.vaso ? html`<div><dt>Vaso</dt><dd>${p.vaso}</dd></div>` : ""}
        <div><dt>Substrato</dt><dd>${p.substrato === "idroponica" ? "Idroponica" : "Terra"}</dd></div>
        ${st.automatica ? "" : html`
          <div><dt>Controllo ogni</dt><dd>${p.giorni_estate} giorni in estate, ${p.giorni_inverno} in inverno</dd></div>
          <div><dt>Se ${v.umida.toLowerCase()}</dt><dd>ricontrollo dopo ${rinvio(st.giorni)} giorni</dd></div>`}
        ${p.note ? html`<div class="nota-lunga"><dt>Note</dt><dd>${p.note}</dd></div>` : ""}
      </dl>

      <section class="sezione">
        <h2>Concime</h2>
        ${concime(p, tolta)}
      </section>

      <section class="sezione">
        <h2>Storico</h2>
        ${storico(p, s.storico.get(p.id))}
      </section>

      ${tolta
        ? html`<button class="btn largo" type="button" data-azione="rimetti" data-id="${p.id}">${icona("undo", 18)}Rimetti in casa</button>`
        : html`<button class="btn largo" type="button" data-azione="togli" data-id="${p.id}">${icona("archive", 18)}Togli dalla casa</button>`}
    </article>`;
}

function concime(p, tolta) {
  const cicli = cicliDi(p);
  if (!cicli.length) {
    return html`<p class="nota">Nessun concime impostato.${tolta ? "" : html` Aggiungilo da <a href="#/pianta/${p.id}/modifica">Modifica</a>.`}</p>`;
  }
  return html`
    <ul class="cicli pannello">${cicli.map(({ ciclo: c, stato: cs }) => html`
      <li class="ciclo-riga ${cs.daFare ? "da-fare" : ""}">
        <span class="storico-icona concimata">${icona("flask", 16)}</span>
        <span class="riga-testo">
          <span class="riga-nome">${c.prodotto}</span>
          <span class="riga-meta">${regolaCiclo(c, p)}</span>
          <span class="riga-stato ${cs.daFare ? "scaduta" : ""}">${statoCicloBreve(cs)}${cs.fatta ? ` · l'ultima volta ${quanto(cs.fatta)}` : ""}</span>
          ${c.note ? html`<span class="riga-meta">${c.note}</span>` : ""}
        </span>
        ${tolta ? "" : html`
          <button class="btn piccolo ${cs.daFare ? "primario" : ""}" type="button" data-azione="concimata" data-id="${p.id}" data-ciclo="${c.id}">Fatto</button>`}
      </li>`)}
    </ul>`;
}

const nomeCura = (c, v) => (c.tipo === "bagnata" ? v.fatto : c.tipo === "controllata" ? v.umida : `Concimata · ${c.prodotto}`);
const iconaCura = (c, v) => (c.tipo === "bagnata" ? v.icona : c.tipo === "controllata" ? "clock" : "flask");

function storico(p, cure) {
  if (!cure) return html`<p class="nota">Carico…</p>`;
  if (!cure.length) return html`<p class="nota">Niente di segnato, per ora.</p>`;
  const v = verbi(p);
  return html`
    <ul class="storico pannello">${cure.map((c) => html`
      <li>
        <span class="storico-icona ${c.tipo}">${icona(iconaCura(c, v), 16)}</span>
        <span class="storico-testo">${nomeCura(c, v)}<span class="riga-meta">${quando(c.il, stato.oggi)}</span></span>
        <button class="icona-btn piccola" type="button" data-azione="cancella-cura" data-cura="${c.id}" data-id="${p.id}"
          aria-label="Cancella questa voce">${icona("x", 16)}</button>
      </li>`)}
    </ul>`;
}

function conferma(p) {
  return html`
    <div class="maniglia" aria-hidden="true"></div>
    <div class="foglio-testa"><h2 id="foglio-titolo">Togliere ${p.nome}?</h2></div>
    <p class="foglio-testo">Sparisce dagli elenchi e smette di mandare promemoria. Lo storico resta: la ritrovi in Account › Piante tolte, da dove puoi rimetterla o eliminarla.</p>
    <div class="foglio-azioni">
      <button class="btn" type="button" data-azione="chiudi-foglio">Annulla</button>
      <button class="btn" type="button" data-azione="conferma-togli" data-id="${p.id}">${icona("archive", 18)}Togli</button>
    </div>`;
}

export const input = {
  "altro-giorno": (el) => { altro.giorno = el.value; },
};

export function abbandona() {
  altro = { id: null, giorno: null };
}

export const azioni = {
  "altro-giorno": (el) => {
    altro = altro.id === el.dataset.id ? { id: null, giorno: null } : { id: el.dataset.id, giorno: null };
    aggiorna({});
  },
  togli: (el) => {
    const p = trovaPianta(el.dataset.id);
    if (p) apriFoglio(conferma(p));
  },
  "conferma-togli": async (el) => {
    const p = trovaPianta(el.dataset.id);
    if (!p) return chiudiFoglio();
    el.disabled = true;
    try {
      await archiviaPianta(p, true);
      chiudiFoglio();
      toast(`${p.nome} tolta dalla casa.`, { azione: () => archiviaPianta(p, false).catch(() => toast("Non riesco a rimetterla. Riprova.")) });
      sostituisci("casa");
    } catch (e) {
      console.error("togli", e);
      el.disabled = false;
      toast("Non ci sono riuscito. Riprova.");
    }
  },
  rimetti: async (el) => {
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
  "cancella-cura": async (el) => {
    const cura = stato.storico.get(el.dataset.id)?.find((c) => c.id === el.dataset.cura);
    if (!cura) return;
    el.disabled = true;
    try {
      await annullaCure([cura]);
      toast("Voce cancellata.");
    } catch (e) {
      console.error("cancella cura", e);
      el.disabled = false;
      toast("Non sono riuscito a cancellarla. Riprova.");
    }
  },
};
