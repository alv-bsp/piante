import { test } from "node:test";
import assert from "node:assert/strict";
import {
  giornoRoma, oraRoma, giorniTra, aggiungiGiorni, stagione, rinvio, statoPianta, daControllare, testoPromemoria, messaggioPush,
  nelMese, statoCiclo, daFareOggi, quantePiante,
} from "../supabase/functions/_shared/scadenze.js";

const pianta = (extra = {}) => ({
  id: "p1", nome: "Monstera deliciosa", stanza: "Salotto", vaso: null, substrato: "terra",
  giorni_estate: 7, giorni_inverno: 14, creata_il: "2026-01-01T10:00:00Z", archiviata_il: null, ...extra,
});

test("giorno e ora a Roma, con l'ora legale", () => {
  assert.equal(giornoRoma("2026-11-04T23:30:00Z"), "2026-11-05");   // 00:30 a Roma (CET, +1)
  assert.equal(giornoRoma("2026-07-01T22:30:00Z"), "2026-07-02");   // 00:30 a Roma (CEST, +2)
  assert.equal(oraRoma("2026-11-04T08:00:00Z"), 9);
  assert.equal(oraRoma("2026-07-01T07:00:00Z"), 9);
  assert.equal(oraRoma("2026-07-01T22:00:00Z"), 0);
});

test("aritmetica dei giorni, anche a cavallo del cambio d'ora", () => {
  assert.equal(giorniTra("2026-10-24", "2026-10-26"), 2);
  assert.equal(aggiungiGiorni("2026-03-28", 2), "2026-03-30");
  assert.equal(aggiungiGiorni("2026-12-30", 3), "2027-01-02");
});

test("stagioni e rinvio", () => {
  assert.equal(stagione("2026-04-01"), "estate");
  assert.equal(stagione("2026-09-30"), "estate");
  assert.equal(stagione("2026-10-01"), "inverno");
  assert.equal(stagione("2026-03-31"), "inverno");
  assert.equal(rinvio(4), 2);
  assert.equal(rinvio(7), 2);
  assert.equal(rinvio(14), 5);
});

test("bagnata lunedì sera, intervallo estivo di 7 giorni: si controlla il lunedì dopo", () => {
  const ultime = { ultima_bagnata: "2026-07-06T19:30:00Z", ultimo_controllo: null }; // lunedì 6 luglio
  assert.equal(statoPianta(pianta(), ultime, "2026-07-12").daControllare, false);
  const lun = statoPianta(pianta(), ultime, "2026-07-13");
  assert.equal(lun.daControllare, true);
  assert.equal(lun.ritardo, 0);
  assert.equal(lun.giorniDaAnnaffiatura, 7);
  assert.equal(statoPianta(pianta(), ultime, "2026-07-15").ritardo, 2);
});

test("in inverno vale l'intervallo invernale", () => {
  const ultime = { ultima_bagnata: "2026-11-01T10:00:00Z" };
  assert.equal(statoPianta(pianta(), ultime, "2026-11-08").daControllare, false);
  assert.equal(statoPianta(pianta(), ultime, "2026-11-15").daControllare, true);
});

test("mai bagnata: conta dal giorno in cui l'hai aggiunta", () => {
  const p = pianta({ creata_il: "2026-11-04T09:00:00Z" });
  const s = statoPianta(p, undefined, "2026-11-04");
  assert.equal(s.daControllare, false);
  assert.equal(s.mancano, 14);
  assert.equal(s.giorniDaAnnaffiatura, null);
});

test("ancora umida: sposta il controllo di un terzo dell'intervallo", () => {
  const ultime = { ultima_bagnata: "2026-11-01T10:00:00Z", ultimo_controllo: "2026-11-15T18:00:00Z" };
  const s = statoPianta(pianta(), ultime, "2026-11-16");
  assert.equal(s.daControllare, false);
  assert.equal(s.scadenza, "2026-11-20");
  assert.equal(statoPianta(pianta(), ultime, "2026-11-20").daControllare, true);
});

test("un controllo prima della scadenza non la anticipa", () => {
  const ultime = { ultima_bagnata: "2026-11-01T10:00:00Z", ultimo_controllo: "2026-11-03T10:00:00Z" };
  assert.equal(statoPianta(pianta(), ultime, "2026-11-04").scadenza, "2026-11-15");
});

test("un controllo vecchio non conta dopo una nuova annaffiatura", () => {
  const ultime = { ultima_bagnata: "2026-11-10T10:00:00Z", ultimo_controllo: "2026-11-09T10:00:00Z" };
  assert.equal(statoPianta(pianta(), ultime, "2026-11-11").scadenza, "2026-11-24");
});

test("daControllare: solo le scadute e non archiviate, dalla più in ritardo", () => {
  const piante = [
    pianta({ id: "a", nome: "Fittonia", giorni_inverno: 5 }),
    pianta({ id: "b", nome: "Strelitzia", giorni_inverno: 10 }),
    pianta({ id: "c", nome: "Pothos", giorni_inverno: 30 }),
    pianta({ id: "d", nome: "Alocasia", giorni_inverno: 1, archiviata_il: "2026-10-01T00:00:00Z" }),
  ];
  const ultime = new Map(["a", "b", "c", "d"].map((id) => [id, { ultima_bagnata: "2026-11-01T10:00:00Z" }]));
  const scadute = daControllare(piante, ultime, "2026-11-12");
  assert.deepEqual(scadute.map((x) => x.pianta.nome), ["Fittonia", "Strelitzia"]);
  assert.equal(scadute[0].stato.ritardo, 6);
});

test("testo della notifica: solo acqua", () => {
  const una = testoPromemoria({ acqua: [{ pianta: pianta(), stato: { giorniDaAnnaffiatura: 9 }, concime: [] }] });
  assert.deepEqual(una, { titolo: "Monstera deliciosa", testo: "Controlla se va bagnata. Ultima annaffiatura 9 giorni fa." });

  const conConcime = testoPromemoria({ acqua: [{ pianta: pianta(), stato: { giorniDaAnnaffiatura: 9 }, concime: [{ prodotto: "Compo liquido piante verdi" }] }] });
  assert.equal(conConcime.testo, "Controlla se va bagnata. Ultima annaffiatura 9 giorni fa. Se la bagni, aggiungi Compo liquido piante verdi.");

  const idro = testoPromemoria({ acqua: [{ pianta: pianta({ nome: "Begonia rex", substrato: "idroponica" }), stato: { giorniDaAnnaffiatura: null }, concime: [] }] });
  assert.equal(idro.testo, "Controlla il livello dell'acqua.");

  const piu = testoPromemoria({ acqua: [
    { pianta: pianta({ nome: "Ficus lyrata", stanza: "Salotto", vaso: "Vaso bianco" }), stato: {}, concime: [] },
    { pianta: pianta({ nome: "Ficus lyrata", stanza: "Salotto", vaso: "Vaso nero" }), stato: {}, concime: [{ prodotto: "Compo" }] },
    { pianta: pianta({ nome: "Begonia rex", substrato: "idroponica" }), stato: {}, concime: [] },
  ] });
  assert.equal(piu.titolo, "3 piante da controllare");
  assert.equal(piu.testo, "Ficus lyrata · vaso bianco, Ficus lyrata · vaso nero (con concime) e Begonia rex (livello dell'acqua).");

  const tante = testoPromemoria({ acqua: Array.from({ length: 8 }, (_, i) => ({ pianta: pianta({ nome: `P${i}` }), stato: {}, concime: [] })) });
  assert.equal(tante.testo, "P0, P1, P2, P3 e altre 4.");
});

test("testo della notifica: concime, da solo e insieme all'acqua", () => {
  const limone = pianta({ nome: "Limone", stanza: "Terrazzo superiore", irrigazione_automatica: true });
  const chelato = { prodotto: "Chelato di ferro EDDHA" };
  const solo = testoPromemoria({ concime: [{ pianta: limone, ciclo: chelato, stato: { giorniDa: 31 } }] });
  assert.deepEqual(solo, { titolo: "Limone: concime", testo: "Chelato di ferro EDDHA. Ultima volta 31 giorni fa." });

  const melo = pianta({ nome: "Melo", stanza: "Terrazzo" });
  const due = testoPromemoria({ concime: [
    { pianta: limone, ciclo: chelato, stato: {} },
    { pianta: melo, ciclo: { prodotto: "Fortigo Frutti Bio" }, stato: {} },
  ] });
  assert.equal(due.titolo, "2 concimi da dare");
  assert.equal(due.testo, "Limone (Chelato di ferro EDDHA) e Melo (Fortigo Frutti Bio).");

  const misto = testoPromemoria({
    acqua: [{ pianta: pianta(), stato: {}, concime: [] }],
    concime: [{ pianta: limone, ciclo: chelato, stato: {} }],
  });
  assert.equal(misto.titolo, "1 da controllare, 1 da concimare");
  assert.equal(misto.testo, "Monstera deliciosa. Concime: Limone (Chelato di ferro EDDHA).");
});

test("irrigazione automatica: mai da controllare per l'acqua", () => {
  const s = statoPianta(pianta({ irrigazione_automatica: true }), { ultima_bagnata: null }, "2026-07-15");
  assert.equal(s.daControllare, false);
  assert.equal(s.automatica, true);
});

const ciclo = (extra = {}) => ({ id: "c1", prodotto: "Compo liquido piante verdi", ogni_giorni: 21, dal_mese: 3, al_mese: 9, con_acqua: true, creato_il: "2026-01-01T10:00:00Z", ...extra });

test("mesi del ciclo, anche a cavallo dell'anno", () => {
  assert.ok(nelMese(ciclo(), 3) && nelMese(ciclo(), 9) && !nelMese(ciclo(), 10) && !nelMese(ciclo(), 2));
  const inverno = ciclo({ dal_mese: 10, al_mese: 2 });
  assert.ok(nelMese(inverno, 11) && nelMese(inverno, 1) && !nelMese(inverno, 3));
});

test("concime: a riposo fuori stagione, subito da fare all'inizio dei mesi", () => {
  const ultima = "2026-09-20T10:00:00Z";
  const nov = statoCiclo(ciclo(), ultima, "2026-11-04");
  assert.equal(nov.attivo, false);
  assert.equal(nov.daFare, false);
  assert.equal(nov.riprende, "marzo");
  assert.equal(statoCiclo(ciclo(), ultima, "2027-03-01").daFare, true);
});

test("concime: ogni N giorni dall'ultima volta, dentro i mesi", () => {
  const ultima = "2026-04-05T18:00:00Z";
  assert.equal(statoCiclo(ciclo(), ultima, "2026-04-25").daFare, false);
  const s = statoCiclo(ciclo(), ultima, "2026-04-26");
  assert.equal(s.daFare, true);
  assert.equal(s.giorniDa, 21);
});

test("concime: un ciclo nuovo aspetta il suo intervallo, mai prima dell'inizio dei mesi", () => {
  assert.equal(statoCiclo(ciclo({ creato_il: "2026-05-10T10:00:00Z" }), null, "2026-05-20").daFare, false);
  assert.equal(statoCiclo(ciclo({ creato_il: "2026-05-10T10:00:00Z" }), null, "2026-05-31").daFare, true);
  assert.equal(statoCiclo(ciclo({ creato_il: "2026-11-04T10:00:00Z" }), null, "2027-03-01").daFare, true);
  assert.equal(statoCiclo(ciclo({ creato_il: "2026-11-04T10:00:00Z" }), null, "2027-02-28").daFare, false);
});

test("daFareOggi: il concime nell'acqua va con l'annaffiatura, gli altri a parte", () => {
  const monstera = pianta({ id: "m", nome: "Monstera" });
  const limone = pianta({ id: "l", nome: "Limone", irrigazione_automatica: true });
  const pothos = pianta({ id: "p", nome: "Pothos" });
  const cicli = new Map([
    ["m", [ciclo({ id: "cm" })]],
    ["l", [ciclo({ id: "cl", prodotto: "Chelato di ferro EDDHA", ogni_giorni: 30, dal_mese: 4, con_acqua: false }),
           ciclo({ id: "cl2", prodotto: "Concime liquido", con_acqua: true })]],
    ["p", [ciclo({ id: "cp" })]],   // concime nell'acqua scaduto, ma acqua non ancora: aspetta
  ]);
  const ultime = new Map([
    ["m", { ultima_bagnata: "2026-05-01T10:00:00Z" }],
    ["l", { ultima_bagnata: null }],
    ["p", { ultima_bagnata: "2026-05-14T10:00:00Z" }],
  ]);
  const ultimeConcime = new Map([["cm", "2026-04-01T10:00:00Z"], ["cl", "2026-04-10T10:00:00Z"], ["cl2", "2026-04-01T10:00:00Z"], ["cp", "2026-04-01T10:00:00Z"]]);
  const oggi = daFareOggi([monstera, limone, pothos], ultime, cicli, ultimeConcime, "2026-05-15");

  assert.deepEqual(oggi.acqua.map((x) => x.pianta.nome), ["Monstera"]);
  assert.deepEqual(oggi.acqua[0].concime.map((c) => c.id), ["cm"]);
  // Limone: irrigazione automatica, quindi anche il concime "nell'acqua" si dà a parte
  assert.deepEqual(oggi.concime.map((x) => x.ciclo.id).sort(), ["cl", "cl2"]);
  assert.equal(quantePiante(oggi), 2);
});

test("messaggio nel formato Declarative Web Push", () => {
  const m = messaggioPush({ titolo: "T", testo: "B" }, "https://alv-bsp.github.io/piante/#/oggi", 3);
  assert.equal(m.web_push, 8030);
  assert.equal(m.notification.title, "T");
  assert.equal(m.notification.navigate, "https://alv-bsp.github.io/piante/#/oggi");
  assert.equal(m.notification.app_badge, "3");
});
