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
 */
export function statoPianta(pianta, ultime, oggi = giornoRoma()) {
  const giorni = intervallo(pianta, oggi);
  const bagnata = ultime?.ultima_bagnata ? giornoRoma(ultime.ultima_bagnata) : null;
  const controllata = ultime?.ultimo_controllo ? giornoRoma(ultime.ultimo_controllo) : null;
  const partenza = bagnata || giornoRoma(pianta.creata_il);

  let scadenza = aggiungiGiorni(partenza, giorni);
  if (controllata && controllata >= partenza) {
    const dopoControllo = aggiungiGiorni(controllata, rinvio(giorni));
    if (dopoControllo > scadenza) scadenza = dopoControllo;
  }
  const mancano = giorniTra(oggi, scadenza);
  return {
    giorni,
    bagnata,
    controllata,
    scadenza,
    mancano,                                   // giorni al prossimo controllo, 0 o meno = da controllare
    daControllare: mancano <= 0,
    ritardo: Math.max(0, -mancano),
    giorniDaAnnaffiatura: bagnata ? giorniTra(bagnata, oggi) : null,
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

/** Titolo e testo della notifica per le piante da controllare (già in ordine di urgenza). */
export function testoPromemoria(scadute) {
  if (!scadute.length) return { titolo: "Piante", testo: "Nessuna pianta da controllare oggi." };
  const nomi = nomiDistinti(scadute);
  if (scadute.length === 1) {
    const { pianta: p, stato: s } = scadute[0];
    const azione = p.substrato === "idroponica" ? "Controlla il livello dell'acqua." : "Controlla se va bagnata.";
    const quando = s.giorniDaAnnaffiatura == null ? "" : ` Ultima annaffiatura ${fa(s.giorniDaAnnaffiatura)}.`;
    return { titolo: nomi[0], testo: azione + quando };
  }
  const etichette = scadute.map(({ pianta: p }, i) => (p.substrato === "idroponica" ? `${nomi[i]} (livello dell'acqua)` : nomi[i]));
  const mostrate = etichette.length > 5 ? [...etichette.slice(0, 4), `altre ${etichette.length - 4}`] : etichette;
  return { titolo: `${scadute.length} piante da controllare`, testo: `${elenco(mostrate)}.` };
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
