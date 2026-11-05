import { html } from "../ui/html.js";
import { icona } from "../ui/icone.js";
import { stato, aggiorna, trovaPianta, statoDi, cicliDi, concimeInAcqua } from "../stato.js";
import { caricaStorico, annullaCure, archiviaPianta, caricaDiario, aggiungiAlDiario, eliminaDalDiario } from "../dati.js";
import { preparaFoto, urlInCache, idrataFoto } from "../foto.js";
import { specieDi } from "../specie.js";
import { mascotte } from "../ui/mascotte.js";
import { vibra, molla, cuori, schizzi } from "../ui/effetti.js";
import { sostituisci } from "../router.js";
import { apriFoglio, chiudiFoglio, toast } from "../ui/avvisi.js";
import { giornoBreve, quanto, traQuanto, quando } from "../tempo.js";
import { rinvio, nelMese, conLAcqua, MESI } from "../../supabase/functions/_shared/scadenze.js";
import { barra, vuoto, verbi, foto, statoCicloBreve } from "./comuni.js";

export const conTabbar = true;

const inArrivo = new Set();
const diarioInArrivo = new Set();
// "Bagnata un altro giorno": aperto e giorno scelto sopravvivono ai ridisegni.
let altro = { id: null, giorno: null };
// Foto del diario appena scelta e non ancora salvata: { piantaId, foto, giorno, nota }.
let nuovaFoto = null;
// Ultimo umore mostrato: se cambia mentre sei sulla scheda (hai appena bagnato), la goccia festeggia.
let ultimo = { id: null, umore: null };

// Cosa dice la goccia quando la tocchi.
const BATTUTE = {
  felice: ["Che solletico!", "Ehi, ciao!", "Si sta bene qui", "Mi fai arrossire"],
  sete: ["Un goccio, dai!", "Ho la gola secca", "Acqua, per favore!"],
  grata: ["Grazie ancora!", "Che bella bevuta", "Adesso sì che si ragiona"],
  dorme: ["Zzz… ancora cinque minuti", "Sto sognando la primavera"],
};

/** Umore della mascotte e cosa dice, dallo stato della pianta. */
function fumetto(p, st, cicli) {
  const v = verbi(p);
  const concimeDaDare = cicli.filter((x) => x.stato.daFare && !conLAcqua(x.ciclo, p));
  if (st.daControllare) {
    return {
      umore: "sete",
      titolo: p.substrato === "idroponica" ? "Controlla il mio livello!" : "Ho sete!",
      testo: st.ritardo
        ? `Dovevi controllarmi ${st.ritardo === 1 ? "ieri" : `${st.ritardo} giorni fa`}. ${st.bagnata ? `Ultima volta ${quanto(st.bagnata)}.` : ""}`
        : `Tocca la terra: se è asciutta, un po' d'acqua.${st.bagnata ? ` Ultima volta ${quanto(st.bagnata)}.` : ""}`,
    };
  }
  if (concimeDaDare.length) {
    return { umore: "sete", titolo: "Ho fame!", testo: `È ora di ${concimeDaDare.map((x) => x.ciclo.prodotto).join(" e ")}.` };
  }
  if (!st.automatica && st.bagnata === stato.oggi) {
    return { umore: "grata", titolo: "Grazie per l'acqua!", testo: `Sei il migliore. Ci rivediamo ${traQuanto(st.mancano)}.` };
  }
  if (st.automatica) {
    const attivi = cicli.filter((x) => x.stato.attivo);
    return attivi.length || !cicli.length
      ? { umore: "felice", titolo: "Sto benissimo", testo: "Mi bagna Home Assistant: tu pensa solo al concime." }
      : { umore: "dorme", titolo: "Sono a riposo", testo: `Mi bagna Home Assistant, il concime riprende a ${cicli[0].stato.riprende}.` };
  }
  return {
    umore: "felice",
    titolo: "Sto benissimo",
    testo: `${st.bagnata ? `${v.fatto} ${quanto(st.bagnata)}. ` : ""}Prossimo controllo ${giornoBreve(st.scadenza)}, ${traQuanto(st.mancano)}.`,
  };
}

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
  if (!s.diario.has(p.id) && !diarioInArrivo.has(p.id)) {
    diarioInArrivo.add(p.id);
    caricaDiario(p.id).catch((e) => console.error("diario", e)).finally(() => diarioInArrivo.delete(p.id));
  }

  const st = statoDi(p);
  const v = verbi(p);
  const tolta = Boolean(p.archiviata_il);
  const cicli = cicliDi(p);
  const f = fumetto(p, st, cicli);
  const specie = specieDi(p);
  const cambiato = ultimo.id === p.id && ultimo.umore !== f.umore;
  ultimo = { id: p.id, umore: f.umore };

  return html`
    <header class="scheda-testa">
      <a class="icona-btn" href="#/casa" aria-label="Torna a Casa">${icona("chevron-left", 20)}</a>
      ${tolta ? html`<span></span>` : html`<a class="icona-btn" href="#/pianta/${p.id}/modifica" aria-label="Modifica">${icona("pencil", 18)}</a>`}
    </header>
    ${avviso}
    <article class="scheda">
      <div class="scheda-titolo">
        <h1 tabindex="-1">${p.nome}</h1>
        <p class="specie">${specie.nome === "Pianta" ? p.tipo || p.stanza : specie.nome} · ${p.stanza}</p>
      </div>

      <div class="ritratto">
        <div class="ritratto-cornice">${foto(p, "copertina", "ritratto-foto", { segnaposto: true })}</div>
        <button class="ritratto-mascotte" type="button" data-azione="mascotte" data-umore="${f.umore}" aria-label="Coccola ${p.nome}">
          ${mascotte(f.umore, 112, { salta: cambiato })}
        </button>
      </div>

      <section class="fumetto ${cambiato ? "cambia" : ""}" aria-live="polite">
        <span class="fumetto-cuore">${icona("heart", 22)}</span>
        <p class="fumetto-titolo">${f.titolo}</p>
        <p class="fumetto-testo">${f.testo}</p>
      </section>

      ${tolta
        ? html`<p class="avviso">${icona("archive", 18)}<span>Tolta dalla casa: non compare negli elenchi e non manda promemoria.</span></p>`
        : pulsantiere(p, st, cicli, s)}

      <section class="sezione">
        <h2>Diario</h2>
        ${diario(p, s.diario.get(p.id), tolta)}
      </section>

      <section class="sezione">
        <h2>Concime</h2>
        ${concime(p, tolta, cicli)}
      </section>

      <section class="sezione">
        <h2>Dettagli</h2>
        <dl class="righe pannello">
          <div><dt>Stanza</dt><dd>${p.stanza}</dd></div>
          ${p.vaso ? html`<div><dt>Vaso</dt><dd>${p.vaso}</dd></div>` : ""}
          <div><dt>Substrato</dt><dd>${p.substrato === "idroponica" ? "Idroponica" : "Terra"}</dd></div>
          ${st.automatica ? html`<div><dt>Acqua</dt><dd>Automatica (Home Assistant)</dd></div>` : html`
            <div><dt>Controllo ogni</dt><dd>${p.giorni_estate} giorni in estate, ${p.giorni_inverno} in inverno</dd></div>
            <div><dt>Se ${v.umida.toLowerCase()}</dt><dd>ricontrollo dopo ${rinvio(st.giorni)} giorni</dd></div>`}
          ${p.note ? html`<div class="nota-lunga"><dt>Note</dt><dd>${p.note}</dd></div>` : ""}
        </dl>
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

/** I pulsanti giocosi: Rimanda a sinistra, Bagna grande in mezzo, Foto a destra. */
function pulsantiere(p, st, cicli, s) {
  const v = verbi(p);
  const inAcqua = st.daControllare ? concimeInAcqua(p) : [];
  const concimeDaDare = cicli.filter((x) => x.stato.daFare && !conLAcqua(x.ciclo, p));
  let centrale;
  if (!st.automatica) {
    centrale = inAcqua.length
      ? html`<button class="tasto-grande acqua chiama" type="button" data-azione="bagnata-concime" data-id="${p.id}">${icona(v.icona, 30, 2.2)}<span>${v.fatto === "Bagnata" ? "Bagna" : "Rabbocca"}</span><small class="tasto-extra">+ concime</small></button>`
      : html`<button class="tasto-grande acqua ${st.daControllare ? "chiama" : ""}" type="button" data-azione="bagnata" data-id="${p.id}">${icona(v.icona, 30, 2.2)}<span>${v.fatto === "Bagnata" ? "Bagna" : "Rabbocca"}</span></button>`;
  } else if (concimeDaDare.length) {
    centrale = html`<button class="tasto-grande concime chiama" type="button" data-azione="concimata" data-id="${p.id}" data-ciclo="${concimeDaDare[0].ciclo.id}">${icona("flask", 28, 2.2)}<span>Concima</span></button>`;
  } else {
    centrale = html`<span class="tasto-grande vuoto-tasto" aria-hidden="true">${icona("sprout", 28, 2)}<span>A posto</span></span>`;
  }
  return html`
    <div class="tastiera">
      ${st.automatica ? html`<span class="tasto-tondo spento" aria-hidden="true"></span>` : html`
        <button class="tasto-tondo rimanda" type="button" data-azione="umida" data-id="${p.id}">
          <span class="zz" aria-hidden="true">z<small>z</small></span><span>${v.umida === "Ancora umida" ? "Umida" : "Livello ok"}</span>
        </button>`}
      ${centrale}
      <button class="tasto-tondo foto-tasto" type="button" data-azione="diario-scegli" data-id="${p.id}">
        ${icona("camera", 24, 2.2)}<span>Foto</span>
      </button>
    </div>
    ${inAcqua.length ? html`<button class="link solo-acqua" type="button" data-azione="bagnata" data-id="${p.id}">Solo acqua, senza concime</button>` : ""}
    ${st.automatica ? "" : html`
      <details class="altro-giorno" ${altro.id === p.id ? "open" : ""}>
        <summary data-azione="altro-giorno" data-id="${p.id}">${v.fatto} un altro giorno</summary>
        <div class="altro-giorno-riga">
          <input id="altro-giorno" type="date" max="${s.oggi}" value="${(altro.id === p.id && altro.giorno) || s.oggi}"
            data-input="altro-giorno" aria-label="Giorno">
          <button class="btn piccolo" type="button" data-azione="bagnata-il" data-id="${p.id}">Segna</button>
        </div>
      </details>`}`;
}

/** Il diario di crescita: foto datate, dalla più recente. */
function diario(p, voci, tolta) {
  if (!voci) return html`<p class="nota">Carico…</p>`;
  return html`
    <div class="diario">
      ${tolta ? "" : html`
        <button class="diario-nuova" type="button" data-azione="diario-scegli" data-id="${p.id}">
          ${icona("camera", 26, 1.8)}<span>Aggiungi</span>
        </button>`}
      ${voci.map((v) => html`
        <button class="diario-voce" type="button" data-azione="diario-apri" data-id="${p.id}" data-voce="${v.id}">
          <img data-foto="${v.miniatura}" ${urlInCache(v.miniatura) ? html`src="${urlInCache(v.miniatura)}"` : ""} alt="Foto del ${giornoBreve(v.giorno)}">
          <span class="diario-data">${giornoBreve(v.giorno)}</span>
        </button>`)}
    </div>
    ${voci.length ? "" : html`<p class="nota">Una foto ogni tanto, con la data: così vedi come cresce, se sta meglio o peggio.</p>`}`;
}

const MESI_BREVI = ["GEN", "FEB", "MAR", "APR", "MAG", "GIU", "LUG", "AGO", "SET", "OTT", "NOV", "DIC"];

/** La stagione del concime in una barra di 12 mesi: mesi attivi in verde, la parte già passata a righe, oggi segnato. */
function stagioneConcime(c, oggi) {
  const m = Number(oggi.slice(5, 7));
  const giorno = Number(oggi.slice(8, 10));
  const attivoOra = nelMese(c, m);
  // Mesi già passati della stagione in corso: dall'inizio della finestra al mese prima di questo.
  const passati = new Set();
  if (attivoOra) for (let k = c.dal_mese; k !== m; k = (k % 12) + 1) passati.add(k);
  const posizione = ((m - 1 + (giorno - 1) / 31) / 12) * 100;
  return html`
    <div class="stagione" aria-hidden="true">
      <div class="stagione-barra">
        ${Array.from({ length: 12 }, (_, i) => i + 1).map((k) => html`
          <span class="stagione-mese ${nelMese(c, k) ? "attivo" : ""} ${passati.has(k) ? "passato" : ""}"></span>`)}
        <span class="stagione-oggi" style="left:${posizione.toFixed(1)}%"></span>
      </div>
      <div class="stagione-etichette">${MESI_BREVI.filter((_, i) => i % 2 === 0).map((x) => html`<span>${x}</span>`)}</div>
    </div>`;
}

function concime(p, tolta, cicli) {
  if (!cicli.length) {
    return html`<p class="nota">Nessun concime impostato.${tolta ? "" : html` Aggiungilo da <a href="#/pianta/${p.id}/modifica">Modifica</a>.`}</p>`;
  }
  return html`
    <div class="cicli">${cicli.map(({ ciclo: c, stato: cs }) => html`
      <div class="ciclo-scheda pannello">
        <div class="ciclo-riga">
          <span class="riga-testo">
            <span class="riga-nome">${c.prodotto}</span>
            <span class="riga-stato ${cs.daFare ? "scaduta" : ""}">${statoCicloBreve(cs)}${cs.fatta ? ` · l'ultima volta ${quanto(cs.fatta)}` : ""}</span>
          </span>
          ${tolta ? "" : html`
            <button class="btn piccolo ${cs.daFare ? "primario" : ""}" type="button" data-azione="concimata" data-id="${p.id}" data-ciclo="${c.id}">Fatto</button>`}
        </div>
        <p class="stagione-titolo">${cs.attivo ? "Stagione del concime" : "A riposo"}</p>
        ${stagioneConcime(c, stato.oggi)}
        <p class="ciclo-frase">Ogni <b>${c.ogni_giorni} giorni</b> da ${MESI[c.dal_mese - 1]} a ${MESI[c.al_mese - 1]}${c.con_acqua && !p.irrigazione_automatica ? ", sciolto nell'acqua" : ""}.${c.note ? ` ${c.note}.` : ""}</p>
      </div>`)}
    </div>`;
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

// ───────────────────────────── diario: fogli

function foglioNuovaFoto() {
  const n = nuovaFoto;
  return html`
    <div class="maniglia" aria-hidden="true"></div>
    <div class="foglio-testa">
      <h2 id="foglio-titolo">Nuova foto</h2>
      <button class="icona-btn" type="button" data-azione="diario-annulla" aria-label="Chiudi">${icona("x")}</button>
    </div>
    ${n.foto ? html`<img class="diario-anteprima" src="${n.foto.anteprima}" alt="Anteprima">` : html`<p class="nota">Preparo la foto…</p>`}
    <label class="campo">
      <span>Giorno</span>
      <input type="date" id="diario-giorno" value="${n.giorno}" max="${stato.oggi}">
    </label>
    <label class="campo">
      <span>Nota <small>facoltativa</small></span>
      <input type="text" id="diario-nota" maxlength="300" placeholder="Es. foglia nuova, punte secche" autocomplete="off">
    </label>
    <div class="foglio-azioni">
      <button class="btn" type="button" data-azione="diario-annulla">Annulla</button>
      <button class="btn primario" type="button" data-azione="diario-salva" ${n.foto ? "" : "disabled"}>Salva</button>
    </div>`;
}

function foglioVoce(p, v) {
  return html`
    <div class="maniglia" aria-hidden="true"></div>
    <div class="foglio-testa">
      <h2 id="foglio-titolo">${p.nome} · ${giornoBreve(v.giorno)}</h2>
      <button class="icona-btn" type="button" data-azione="chiudi-foglio" aria-label="Chiudi">${icona("x")}</button>
    </div>
    <img class="diario-anteprima" data-foto="${v.foto}" ${urlInCache(v.foto) ? html`src="${urlInCache(v.foto)}"` : ""} alt="Foto del ${giornoBreve(v.giorno)}">
    ${v.nota ? html`<p class="foglio-testo">${v.nota}</p>` : ""}
    <button class="btn largo" type="button" data-azione="diario-elimina" data-id="${p.id}" data-voce="${v.id}">${icona("trash", 18)}Elimina foto</button>`;
}

/** Foto scelta dal selettore (main.js): la prepara nel browser e chiede il giorno. */
export function fotoScelta(piantaId, file) {
  const questa = { piantaId, foto: null, giorno: stato.oggi };
  nuovaFoto = questa;
  apriFoglio(foglioNuovaFoto(), "diario");
  preparaFoto(file)
    .then((f) => {
      if (nuovaFoto !== questa) return URL.revokeObjectURL(f.anteprima);
      questa.foto = f;
      apriFoglio(foglioNuovaFoto(), "diario");
    })
    .catch((e) => {
      console.error("foto", e);
      chiudiFoglio();
      toast("Non riesco a leggere questa foto. Prova con un'altra.");
    });
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
  ultimo = { id: null, umore: null };
}

let battuta = null;
/** La goccia coccolata: rimbalza, manda cuori e dice qualcosa per un paio di secondi. */
function coccola(el) {
  const svg = el.querySelector("svg");
  vibra();
  molla(svg);
  cuori(el, el.dataset.umore === "sete" ? 3 : 5);
  const titolo = document.querySelector("#app .fumetto-titolo");
  if (!titolo) return;
  const frasi = BATTUTE[el.dataset.umore] || BATTUTE.felice;
  const originale = battuta?.el === titolo ? battuta.originale : titolo.textContent;
  let frase = frasi[Math.floor(Math.random() * frasi.length)];
  if (frase === titolo.textContent) frase = frasi[(frasi.indexOf(frase) + 1) % frasi.length];
  titolo.textContent = frase;
  titolo.parentElement.classList.remove("parla");
  void titolo.offsetWidth; // riparte l'animazione
  titolo.parentElement.classList.add("parla");
  clearTimeout(battuta?.timer);
  battuta = {
    el: titolo,
    originale,
    timer: setTimeout(() => {
      if (titolo.isConnected) titolo.textContent = originale;
      battuta = null;
    }, 2600),
  };
}

const voceDi = (el) => stato.diario.get(el.dataset.id)?.find((v) => v.id === el.dataset.voce);

export const azioni = {
  mascotte: coccola,
  "diario-apri": (el) => {
    const p = trovaPianta(el.dataset.id);
    const v = voceDi(el);
    if (!p || !v) return;
    apriFoglio(foglioVoce(p, v), "diario-voce");
    idrataFoto(document.getElementById("foglio"));
  },
  "diario-annulla": () => {
    if (nuovaFoto?.foto) URL.revokeObjectURL(nuovaFoto.foto.anteprima);
    nuovaFoto = null;
    chiudiFoglio();
  },
  "diario-salva": async (el) => {
    const n = nuovaFoto;
    const p = n && trovaPianta(n.piantaId);
    if (!p || !n.foto) return;
    const giorno = document.getElementById("diario-giorno")?.value || stato.oggi;
    const nota = document.getElementById("diario-nota")?.value || "";
    if (giorno > stato.oggi) return toast("Il giorno non può essere nel futuro.");
    el.disabled = true;
    el.setAttribute("aria-busy", "true");
    try {
      await aggiungiAlDiario(p, n.foto, giorno, nota);
      nuovaFoto = null;
      chiudiFoglio();
      vibra();
      const voce = document.querySelector(`#app .diario-voce[data-id="${p.id}"]`);
      molla(voce, 0.6);
      schizzi(voce, "concime", { quante: 8, forza: 0.7 });
      toast("Foto aggiunta al diario.");
    } catch (e) {
      console.error("diario", e);
      el.disabled = false;
      el.removeAttribute("aria-busy");
      toast(navigator.onLine ? "Non sono riuscito a salvarla. Hai eseguito supabase/modifiche/2026-11-05-diario.sql?" : "Sei offline: riprova quando c'è rete.", { durata: 6000 });
    }
  },
  "diario-elimina": async (el) => {
    const v = voceDi(el);
    if (!v) return;
    el.disabled = true;
    try {
      await eliminaDalDiario(v);
      chiudiFoglio();
      toast("Foto eliminata.");
    } catch (e) {
      console.error("diario", e);
      el.disabled = false;
      toast("Non sono riuscito a eliminarla. Riprova.");
    }
  },
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
