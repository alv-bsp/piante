import { html } from "../ui/html.js";
import { icona } from "../ui/icone.js";
import { stato, tolte, trovaPianta, tipi } from "../stato.js";
import { salvaOra, archiviaPianta, eliminaPianta, aggiungiSpecie, cambiaConcimeSpecie, eliminaSpecie } from "../dati.js";
import { SPECIE, GENERICA, specieDi, fotoSpecie, normalizza } from "../specie.js";
import { PROGRAMMI, programmaDi } from "../concimi.js";
import { contaPiante } from "./comuni.js";
import { attivaNotifiche, disattivaNotifiche, inviaProva, spiegazione } from "../notifiche.js";
import { apriFoglio, foglioAperto, toast } from "../ui/avvisi.js";
import { VERSIONE } from "../config.js";

// Foglio Account: promemoria (notifiche su questo dispositivo e ora), specie, piante tolte, uscita.

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

    ${sezioneSpecie(s)}

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

// ───────────────────────────── specie

/**
 * Le specie aggiunte da te: quelle salvate (tabella specie_mie) più quelle che esistono solo come tipo di una
 * pianta. Per ognuna quante piante la usano e il suo concime.
 */
function specieMie(s) {
  const usate = (nome) => (s.piante || []).filter((p) => !p.archiviata_il && normalizza(p.tipo) === normalizza(nome)).length;
  const righe = s.specieMie.map((x) => ({ nome: x.nome, concime: x.concime, salvata: true }));
  for (const t of tipi()) {
    if (specieDi({ tipo: t }) === GENERICA && !righe.some((r) => normalizza(r.nome) === normalizza(t))) {
      righe.push({ nome: t, concime: "verdi", salvata: false });
    }
  }
  return righe
    .map((r) => ({ ...r, piante: usate(r.nome) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "it"));
}

const scelteConcime = (attuale) => Object.entries(PROGRAMMI)
  .filter(([, prog]) => prog.scelta)
  .map(([chiave, prog]) => html`<option value="${chiave}" ${chiave === attuale ? "selected" : ""}>${prog.nome}</option>`);

function sezioneSpecie(s) {
  const mie = specieMie(s);
  return html`
    <section class="foglio-sezione">
      <h3>Specie</h3>
      <p class="aiuto">Le specie che hai aggiunto tu, con il concime che l'editor propone per le loro piante.</p>
      ${s.specieMieOk ? "" : html`
        <p class="stato-notifiche">${icona("alert", 18)}<span>Per salvarle esegui <b>supabase/modifiche/2026-11-06-specie.sql</b> nel SQL Editor di Supabase.</span></p>`}
      ${mie.length ? html`
        <ul class="elenco">${mie.map((m) => html`
          <li class="riga-specie">
            <span class="riga-testo">
              <span class="riga-nome">${m.nome}</span>
              <span class="riga-meta">${m.piante ? contaPiante(m.piante) : "Nessuna pianta"}</span>
            </span>
            <select class="scelta-concime" data-azione-change="specie-concime" data-nome="${m.nome}" aria-label="Concime per ${m.nome}">
              ${scelteConcime(m.concime)}
            </select>
            <button class="icona-btn piccola" type="button" data-azione="specie-elimina" data-nome="${m.nome}"
              aria-label="Elimina ${m.nome}">${icona("trash", 16)}</button>
          </li>`)}
        </ul>` : html`<p class="nota">Nessuna, per ora.</p>`}
      <div class="nuova-specie">
        <input type="text" id="nuova-specie" maxlength="40" placeholder="Nuova specie, es. Calathea" autocomplete="off"
          autocapitalize="words" spellcheck="false" aria-label="Nuova specie">
        <select id="nuova-specie-concime" class="scelta-concime" aria-label="Concime">${scelteConcime("verdi")}</select>
        <button class="btn piccolo primario" type="button" data-azione="specie-aggiungi">${icona("plus", 16)}Aggiungi</button>
      </div>
      <details class="specie-note">
        <summary>${SPECIE.length} specie con la foto ${icona("chevron-right", 16)}</summary>
        <ul class="elenco">${[...SPECIE].sort((a, b) => a.nome.localeCompare(b.nome, "it")).map((sp) => html`
          <li class="riga-specie">
            <span class="foto mini"><img src="${fotoSpecie(sp, "mini")}" alt="" loading="lazy"></span>
            <span class="riga-testo">
              <span class="riga-nome">${sp.nome}</span>
              <span class="riga-meta">Concime: ${programmaDi({ tipo: sp.nome }).nome.toLowerCase()}</span>
            </span>
          </li>`)}
        </ul>
      </details>
    </section>`;
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
  "specie-aggiungi": async (el) => {
    const campo = document.getElementById("nuova-specie");
    const nome = campo?.value.trim();
    if (!nome) {
      campo?.focus();
      return toast("Scrivi il nome della specie.");
    }
    if (specieDi({ tipo: nome }) !== GENERICA && SPECIE.some((sp) => normalizza(sp.nome) === normalizza(nome))) {
      return toast(`${nome} c'è già, con la sua foto.`);
    }
    if (!stato.specieMieOk) return toast("Prima esegui supabase/modifiche/2026-11-06-specie.sql in Supabase.", { durata: 6000 });
    el.disabled = true;
    try {
      await aggiungiSpecie(nome, document.getElementById("nuova-specie-concime")?.value || "verdi");
      toast(`${nome} aggiunta alle specie.`);
    } catch (e) {
      console.error("specie", e);
      el.disabled = false;
      toast("Non sono riuscito ad aggiungerla. Riprova.");
    }
  },
  "specie-elimina": (el) => {
    const nome = el.dataset.nome;
    const quante = (stato.piante || []).filter((p) => normalizza(p.tipo) === normalizza(nome)).length;
    if (!quante) return eliminaEDici(nome, el);
    apriFoglio(html`
      <div class="maniglia" aria-hidden="true"></div>
      <div class="foglio-testa"><h2 id="foglio-titolo">Eliminare ${nome}?</h2></div>
      <p class="foglio-testo">È la specie di ${contaPiante(quante)}: restano, ma senza specie. Puoi sceglierne un'altra da Modifica.</p>
      <div class="foglio-azioni">
        <button class="btn" type="button" data-azione="account">Annulla</button>
        <button class="btn" type="button" data-azione="conferma-elimina-specie" data-nome="${nome}">${icona("trash", 18)}Elimina</button>
      </div>`, "conferma");
  },
  "conferma-elimina-specie": (el) => eliminaEDici(el.dataset.nome, el).then(apri),
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

async function eliminaEDici(nome, el) {
  el.disabled = true;
  try {
    const quante = await eliminaSpecie(nome);
    toast(quante ? `${nome} eliminata: ${contaPiante(quante)} senza specie.` : `${nome} eliminata.`);
  } catch (e) {
    console.error("elimina specie", e);
    el.disabled = false;
    toast("Non sono riuscito a eliminarla. Riprova.");
  }
}

/** Concime di una specie (select): si salva subito. Una specie che esisteva solo come tipo di pianta si salva ora. */
export async function cambiaConcime(el) {
  const nome = el.dataset.nome;
  const concime = el.value;
  if (!stato.specieMieOk) return toast("Prima esegui supabase/modifiche/2026-11-06-specie.sql in Supabase.", { durata: 6000 });
  try {
    const riga = stato.specieMie.find((x) => normalizza(x.nome) === normalizza(nome));
    if (riga) await cambiaConcimeSpecie(riga, concime);
    else await aggiungiSpecie(nome, concime);
    toast(`${nome}: ${PROGRAMMI[concime].nome.toLowerCase()}.`);
  } catch (e) {
    console.error("concime specie", e);
    toast("Non sono riuscito a salvarlo. Riprova.");
  }
}

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
