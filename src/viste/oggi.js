import { html } from "../ui/html.js";
import { icona } from "../ui/icone.js";
import { inOrdine } from "../stato.js";
import { stagione } from "../../supabase/functions/_shared/scadenze.js";
import { giornoLungo, quanto, traQuanto } from "../tempo.js";
import { spiegazione } from "../notifiche.js";
import { PIANTE_DI_PARTENZA } from "../partenza.js";
import { testata, vuoto, azioniCura, verbi, contaPiante } from "./comuni.js";

export const titolo = "Oggi";
export const conTabbar = true;
export const fab = () => "";

const PROSSIMI_GIORNI = 3;

export function render(s, { avviso = "" } = {}) {
  const sotto = `${giornoLungo(s.oggi)} · ${stagione(s.oggi)}`;
  if (s.piante == null) return html`${testata(titolo, s.caricamento ? "Carico…" : sotto)}${avviso}`;

  const tutte = inOrdine();
  if (!tutte.length) return html`${testata(titolo, sotto)}${avviso}${benvenuto(s)}`;

  const scadute = tutte.filter((x) => x.stato.daControllare);
  const prossime = tutte.filter((x) => x.stato.mancano > 0 && x.stato.mancano <= PROSSIMI_GIORNI);

  return html`
    ${testata(titolo, sotto)}
    ${avviso}
    ${invitoNotifiche(s)}
    ${scadute.length
      ? html`
        <h2 class="titoletto">Da controllare <span class="conta">${scadute.length}</span></h2>
        <ul class="carte">${scadute.map(carta)}</ul>`
      : tuttoAPosto(tutte[0])}
    ${prossime.length ? html`
      <h2 class="titoletto">Nei prossimi giorni</h2>
      <ul class="elenco">${prossime.map(({ pianta: p, stato: st }) => html`
        <li>
          <a class="riga" href="#/pianta/${p.id}">
            <span class="riga-testo">
              <span class="riga-nome">${p.nome}</span>
              <span class="riga-meta">${p.stanza}</span>
            </span>
            <span class="riga-quando">${traQuanto(st.mancano)}</span>
            ${icona("chevron-right", 18)}
          </a>
        </li>`)}
      </ul>` : ""}`;
}

function carta({ pianta: p, stato: st }) {
  const v = verbi(p);
  const ultima = st.bagnata ? `${v.fatta} ${quanto(st.bagnata)}` : "mai segnata";
  const consiglio = p.note || (p.substrato === "idroponica"
    ? "Controlla il livello dell'acqua e rabbocca se serve."
    : "Tocca il terriccio: se i primi centimetri sono asciutti, bagnala.");
  return html`
    <li class="carta">
      <a class="carta-testa" href="#/pianta/${p.id}">
        <span class="riga-testo">
          <span class="carta-nome">${p.nome}</span>
          <span class="riga-meta">${p.stanza} · ${ultima}${st.ritardo ? html` · <b class="in-ritardo">${st.ritardo === 1 ? "da ieri" : `da ${st.ritardo} giorni`}</b>` : ""}</span>
        </span>
        ${icona("chevron-right", 18)}
      </a>
      <p class="carta-nota">${consiglio}</p>
      ${azioniCura(p)}
    </li>`;
}

function tuttoAPosto(prima) {
  const prossima = prima ? `Prossimo controllo: ${prima.pianta.nome}, ${traQuanto(prima.stato.mancano)}.` : "";
  return html`
    <section class="a-posto">
      <div class="vuoto-icona">${icona("check", 30, 2)}</div>
      <h2>Tutto a posto</h2>
      <p>Nessuna pianta da controllare oggi. ${prossima}</p>
    </section>`;
}

function invitoNotifiche(s) {
  if (s.notifiche === "attive" || s.notifiche === "verifico" || s.notifiche === "non-supportate") return "";
  const testo = s.notifiche === "spente"
    ? "Attiva i promemoria: ogni mattina ti avviso se c'è una pianta da controllare."
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
    testo: `Aggiungile una alla volta, oppure parti dalle ${contaPiante(PIANTE_DI_PARTENZA.length)} che conosco già: poi sistemi stanze e intervalli.`,
    azione: html`
      <div class="vuoto-azioni">
        <button class="btn primario" type="button" data-azione="partenza" ${s.caricamento ? "disabled" : ""}>${icona("sprout", 18)}Carica le mie piante</button>
        <a class="btn" href="#/nuova">${icona("plus", 18)}Aggiungi una pianta</a>
      </div>`,
  });
}
