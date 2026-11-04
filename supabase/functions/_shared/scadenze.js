// Regole dei promemoria, le stesse per l'app e per la funzione che manda le notifiche (promemoria/index.ts).
// JavaScript puro senza dipendenze: gira nel browser, in Deno e in Node (test/scadenze.test.js).
//
// Una pianta va controllata quando sono passati N giorni dall'ultima annaffiatura, con N diverso in estate e in
// inverno. "Ancora umida" (un controllo senza acqua) sposta il prossimo controllo di circa un terzo di N.
// Tutto ragiona in giorni di calendario a Roma: bagnata lunedì sera con N = 7, si controlla il lunedì dopo.

export const FUSO = "Europe/Rome";
/** Mesi in cui vale l'intervallo estivo: da aprile a settembre. Gli altri usano quello invernale. */
export const MESI_ESTATE = [4, 5, 6, 7, 8, 9];

const formatoGiorno = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" });
const formatoOra = new Intl.DateTimeFormat("en-GB", { timeZone: FUSO, hour: "2-digit", hourCycle: "h23" });
const GIORNO_MS = 86_400_000;

/** Giorno di calendario a Roma (AAAA-MM-GG) di un istante (Date, ISO o millisecondi). */
export const giornoRoma = (istante = new Date()) => formatoGiorno.format(new Date(istante));

/** Ora a Roma (0–23) di un istante. */
export const oraRoma = (istante = new Date()) => Number(formatoOra.format(new Date(istante)));

const utc = (giorno) => {
  const [a, m, g] = giorno.split("-").map(Number);
  return Date.UTC(a, m - 1, g);
};

/** Giorni di calendario da `da` ad `a` (positivo se `a` viene dopo). */
export const giorniTra = (da, a) => Math.round((utc(a) - utc(da)) / GIORNO_MS);

export const aggiungiGiorni = (giorno, n) => new Date(utc(giorno) + n * GIORNO_MS).toISOString().slice(0, 10);

export const stagione = (giorno) => (MESI_ESTATE.includes(Number(giorno.slice(5, 7))) ? "estate" : "inverno");

export const intervallo = (pianta, giorno) =>
  stagione(giorno) === "estate" ? pianta.giorni_estate : pianta.giorni_inverno;

/** Dopo "Ancora umida" si ricontrolla tra un terzo dell'intervallo, mai prima di 2 giorni. */
export const rinvio = (giorni) => Math.max(2, Math.round(giorni / 3));

/**
 * Stato di una pianta in un certo giorno.
 * `ultime` è la riga della vista ultime_cure: { ultima_bagnata, ultimo_controllo }, istanti ISO o null.
 * Una pianta mai bagnata conta dal giorno in cui l'hai aggiunta, così le piante nuove non scattano subito.
 * Con l'irrigazione automatica (melo, limone: ci pensa Home Assistant) non va mai controllata per l'acqua.
 */
export function statoPianta(pianta, ultime, oggi = giornoRoma()) {
  const giorni = intervallo(pianta, oggi);
  const bagnata = ultime?.ultima_bagnata ? giornoRoma(ultime.ultima_bagnata) : null;
  const controllata = ultime?.ultimo_controllo ? giornoRoma(ultime.ultimo_controllo) : null;
  const giorniDaAnnaffiatura = bagnata ? giorniTra(bagnata, oggi) : null;
  if (pianta.irrigazione_automatica) {
    return { automatica: true, giorni, bagnata, controllata, scadenza: null, mancano: Infinity, daControllare: false, ritardo: 0, giorniDaAnnaffiatura };
  }
  const partenza = bagnata || giornoRoma(pianta.creata_il);

  let scadenza = aggiungiGiorni(partenza, giorni);
  if (controllata && controllata >= partenza) {
    const dopoControllo = aggiungiGiorni(controllata, rinvio(giorni));
    if (dopoControllo > scadenza) scadenza = dopoControllo;
  }
  const mancano = giorniTra(oggi, scadenza);
  return {
    automatica: false,
    giorni,
    bagnata,
    controllata,
    scadenza,
    mancano,                                   // giorni al prossimo controllo, 0 o meno = da controllare
    daControllare: mancano <= 0,
    ritardo: Math.max(0, -mancano),
    giorniDaAnnaffiatura,
  };
}

/** Piante attive con il loro stato, dalla più urgente. `ultime` è una Map pianta_id → riga di ultime_cure. */
export function inOrdineDiScadenza(piante, ultime, oggi = giornoRoma()) {
  return piante
    .filter((p) => !p.archiviata_il)
    .map((pianta) => ({ pianta, stato: statoPianta(pianta, ultime.get(pianta.id), oggi) }))
    .sort((a, b) => a.stato.mancano - b.stato.mancano || a.pianta.nome.localeCompare(b.pianta.nome, "it"));
}

export const daControllare = (piante, ultime, oggi = giornoRoma()) =>
  inOrdineDiScadenza(piante, ultime, oggi).filter((x) => x.stato.daControllare);

// ───────────────────────────── concime
// Ogni pianta ha zero o più cicli: prodotto, ogni quanti giorni, da che mese a che mese (anche a cavallo
// dell'anno, es. ottobre–febbraio). Fuori dai mesi il ciclo è a riposo. All'inizio dei suoi mesi un ciclo è subito
// da fare, a meno che l'ultima volta sia ancora "fresca"; un ciclo appena creato aspetta il suo intervallo.

export const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

export const nelMese = (ciclo, mese) =>
  ciclo.dal_mese <= ciclo.al_mese
    ? mese >= ciclo.dal_mese && mese <= ciclo.al_mese
    : mese >= ciclo.dal_mese || mese <= ciclo.al_mese;

/** Primo giorno dei mesi del ciclo in corso (per un ciclo attivo oggi). */
function inizioCiclo(ciclo, oggi) {
  const anno = Number(oggi.slice(0, 4));
  const mese = Number(oggi.slice(5, 7));
  const a = ciclo.dal_mese <= ciclo.al_mese || mese >= ciclo.dal_mese ? anno : anno - 1;
  return `${a}-${String(ciclo.dal_mese).padStart(2, "0")}-01`;
}

/** Stato di un ciclo di concime. `ultima` è l'istante ISO dell'ultima concimazione di quel ciclo, o null. */
export function statoCiclo(ciclo, ultima, oggi = giornoRoma()) {
  const fatta = ultima ? giornoRoma(ultima) : null;
  const giorniDa = fatta ? giorniTra(fatta, oggi) : null;
  if (!nelMese(ciclo, Number(oggi.slice(5, 7)))) {
    return { attivo: false, daFare: false, fatta, giorniDa, scadenza: null, mancano: Infinity, riprende: MESI[ciclo.dal_mese - 1] };
  }
  const inizio = inizioCiclo(ciclo, oggi);
  const dopoIntervallo = aggiungiGiorni(fatta || giornoRoma(ciclo.creato_il), ciclo.ogni_giorni);
  const scadenza = dopoIntervallo > inizio ? dopoIntervallo : inizio;
  const mancano = giorniTra(oggi, scadenza);
  return { attivo: true, daFare: mancano <= 0, fatta, giorniDa, scadenza, mancano, riprende: null };
}

/** Un concime sciolto nell'acqua, su una pianta che bagni a mano, si dà alla prossima annaffiatura. */
export const conLAcqua = (ciclo, pianta) => Boolean(ciclo.con_acqua) && !pianta.irrigazione_automatica;

/**
 * Cosa c'è da fare oggi.
 *   acqua:   piante da controllare, dalla più in ritardo, con i concimi da sciogliere nell'acqua se sono scaduti
 *   concime: cicli scaduti da dare a parte (granulare, chelato, piante con irrigazione automatica)
 * `cicli` è una Map pianta_id → [ciclo]; `ultimeConcime` una Map ciclo_id → istante ISO.
 */
export function daFareOggi(piante, ultime, cicli, ultimeConcime, oggi = giornoRoma()) {
  const acqua = [];
  const concime = [];
  for (const { pianta, stato } of inOrdineDiScadenza(piante, ultime, oggi)) {
    const scaduti = (cicli.get(pianta.id) || [])
      .map((ciclo) => ({ ciclo, stato: statoCiclo(ciclo, ultimeConcime.get(ciclo.id), oggi) }))
      .filter((x) => x.stato.daFare);
    if (stato.daControllare) acqua.push({ pianta, stato, concime: scaduti.filter((x) => conLAcqua(x.ciclo, pianta)).map((x) => x.ciclo) });
    for (const x of scaduti) if (!conLAcqua(x.ciclo, pianta)) concime.push({ pianta, ...x });
  }
  concime.sort((a, b) => a.stato.mancano - b.stato.mancano || a.pianta.nome.localeCompare(b.pianta.nome, "it"));
  return { acqua, concime };
}

/** Quante piante hanno qualcosa da fare (per il numerino sull'icona). */
export const quantePiante = ({ acqua, concime }) => new Set([...acqua, ...concime].map((x) => x.pianta.id)).size;

// ───────────────────────────── testo della notifica

export const fa = (n) => (n === 0 ? "oggi" : n === 1 ? "ieri" : `${n} giorni fa`);

/** Due piante con lo stesso nome si distinguono con la stanza (o il vaso, se sono nella stessa stanza). */
function nomiDistinti(voci) {
  const conta = (f) => voci.reduce((m, v) => m.set(f(v), (m.get(f(v)) || 0) + 1), new Map());
  const perNome = conta((v) => v.pianta.nome);
  const perNomeStanza = conta((v) => `${v.pianta.nome}|${v.pianta.stanza}`);
  return voci.map(({ pianta: p }) => {
    if (perNome.get(p.nome) === 1) return p.nome;
    if (perNomeStanza.get(`${p.nome}|${p.stanza}`) === 1 || !p.vaso) return `${p.nome} · ${p.stanza.toLowerCase()}`;
    return `${p.nome} · ${p.vaso.toLowerCase()}`;
  });
}

const elenco = (nomi) => (nomi.length === 1 ? nomi[0] : `${nomi.slice(0, -1).join(", ")} e ${nomi.at(-1)}`);
const alMassimo = (etichette, n = 5) => (etichette.length > n ? [...etichette.slice(0, n - 1), `altre ${etichette.length - n + 1}`] : etichette);
const prodotto = (c) => c.prodotto;

/**
 * Titolo e testo della notifica del mattino, da daFareOggi().
 * @param {{ acqua?: any[], concime?: any[] }} cose
 */
export function testoPromemoria({ acqua = [], concime = [] }) {
  if (!acqua.length && !concime.length) return { titolo: "Piante", testo: "Niente da fare oggi." };

  const nomiAcqua = nomiDistinti(acqua);
  const etichetteAcqua = acqua.map(({ pianta: p, concime: c }, i) =>
    p.substrato === "idroponica" ? `${nomiAcqua[i]} (livello dell'acqua)` : c.length ? `${nomiAcqua[i]} (con concime)` : nomiAcqua[i]);
  const nomiConcime = nomiDistinti(concime);
  const etichetteConcime = concime.map((x, i) => `${nomiConcime[i]} (${prodotto(x.ciclo)})`);

  if (!concime.length) {
    if (acqua.length === 1) {
      const { stato: s, pianta: p, concime: c } = acqua[0];
      const azione = p.substrato === "idroponica" ? "Controlla il livello dell'acqua." : "Controlla se va bagnata.";
      const quando = s.giorniDaAnnaffiatura == null ? "" : ` Ultima annaffiatura ${fa(s.giorniDaAnnaffiatura)}.`;
      const conc = c.length ? ` Se la bagni, aggiungi ${elenco(c.map(prodotto))}.` : "";
      return { titolo: nomiAcqua[0], testo: azione + quando + conc };
    }
    return { titolo: `${acqua.length} piante da controllare`, testo: `${elenco(alMassimo(etichetteAcqua))}.` };
  }

  if (!acqua.length) {
    if (concime.length === 1) {
      const { ciclo: c, stato: s } = concime[0];
      const quando = s.giorniDa == null ? "" : ` Ultima volta ${fa(s.giorniDa)}.`;
      return { titolo: `${nomiConcime[0]}: concime`, testo: `${c.prodotto}.${quando}` };
    }
    return { titolo: `${concime.length} concimi da dare`, testo: `${elenco(alMassimo(etichetteConcime))}.` };
  }

  const titolo = `${acqua.length} da controllare, ${concime.length} da concimare`;
  return { titolo, testo: `${elenco(alMassimo(etichetteAcqua, 4))}. Concime: ${elenco(alMassimo(etichetteConcime, 3))}.` };
}

/**
 * Messaggio push nel formato Declarative Web Push (web_push: 8030): Safari su iPhone lo mostra da solo, senza
 * service worker; gli altri browser lo passano a public/sw.js, che lo mostra uguale.
 */
export function messaggioPush({ titolo, testo }, url, badge) {
  const notification = { title: titolo, body: testo, navigate: url, lang: "it-IT", dir: "ltr", silent: false };
  if (Number.isInteger(badge) && badge >= 0) notification.app_badge = String(badge);
  return { web_push: 8030, notification };
}
