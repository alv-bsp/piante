import { html } from "../ui/html.js";
import { icona } from "../ui/icone.js";
import { inOrdine, oggiDaFare } from "../stato.js";
import { stagione } from "../../supabase/functions/_shared/scadenze.js";
import { giornoLungo, quanto, traQuanto } from "../tempo.js";
import { spiegazione } from "../notifiche.js";
import { PIANTE_DI_PARTENZA } from "../partenza.js";
import { testata, vuoto, azioniCura, verbi, contaPiante, miniatura, foto, regolaCiclo } from "./comuni.js";

export const titolo = "Oggi";
export const conTabbar = true;

const PROSSIMI_GIORNI = 3;

const saluto = () => {
  const h = new Date().getHours();
  return h < 13 ? "Buongiorno" : h < 18 ? "Buon pomeriggio" : "Buonasera";
};

export function render(s, { avviso = "" } = {}) {
  const sotto = `${saluto()} · ${giornoLungo(s.oggi)}`;
  if (s.piante == null) return html`${testata(titolo, s.caricamento ? "Carico…" : sotto)}${avviso}`;

  const tutte = inOrdine();
  if (!tutte.length) return html`${testata(titolo, sotto)}${avviso}${benvenuto(s)}`;

  const { acqua, concime } = oggiDaFare();
  const prossime = tutte.filter((x) => x.stato.mancano > 0 && x.stato.mancano <= PROSSIMI_GIORNI);

  return html`
    ${testata(titolo, sotto)}
    ${avviso}
    ${invitoNotifiche(s)}
    ${acqua.length ? html`
      <h2 class="titoletto">Da controllare <span class="conta">${acqua.length}</span></h2>
      <ul class="carte">${acqua.map(cartaAcqua)}</ul>` : ""}
    ${concime.length ? html`
      <h2 class="titoletto">Da concimare <span class="conta">${concime.length}</span></h2>
      <ul class="carte">${concime.map(cartaConcime)}</ul>` : ""}
    ${!acqua.length && !concime.length ? tuttoAPosto(prossime[0] || tutte.find((x) => Number.isFinite(x.stato.mancano)), s) : ""}
    ${prossime.length ? html`
      <h2 class="titoletto">Nei prossimi giorni</h2>
      <div class="pannello">
        <ul class="elenco">${prossime.map(({ pianta: p, stato: st }) => html`
          <li>
            <a class="riga" href="#/pianta/${p.id}">
              ${miniatura(p)}
              <span class="riga-testo">
                <span class="riga-nome">${p.nome}</span>
                <span class="riga-meta">${p.stanza}</span>
              </span>
              <span class="riga-quando">${traQuanto(st.mancano)}</span>
            </a>
          </li>`)}
        </ul>
      </div>` : ""}`;
}

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

function tuttoAPosto(prima) {
  const prossima = prima ? `Prossimo controllo: ${prima.pianta.nome}, ${traQuanto(prima.stato.mancano)}.` : "";
  return html`
    <section class="a-posto">
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
