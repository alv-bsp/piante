import { test } from "node:test";
import assert from "node:assert/strict";
import {
  giornoRoma, oraRoma, giorniTra, aggiungiGiorni, stagione, rinvio, statoPianta, daControllare, testoPromemoria, messaggioPush,
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

test("testo della notifica", () => {
  const una = testoPromemoria([{ pianta: pianta(), stato: { giorniDaAnnaffiatura: 9 } }]);
  assert.deepEqual(una, { titolo: "Monstera deliciosa", testo: "Controlla se va bagnata. Ultima annaffiatura 9 giorni fa." });

  const idro = testoPromemoria([{ pianta: pianta({ nome: "Begonia rex", substrato: "idroponica" }), stato: { giorniDaAnnaffiatura: null } }]);
  assert.equal(idro.testo, "Controlla il livello dell'acqua.");

  const piu = testoPromemoria([
    { pianta: pianta({ nome: "Ficus lyrata", stanza: "Salotto", vaso: "Vaso bianco" }), stato: {} },
    { pianta: pianta({ nome: "Ficus lyrata", stanza: "Salotto", vaso: "Vaso nero" }), stato: {} },
    { pianta: pianta({ nome: "Begonia rex", substrato: "idroponica" }), stato: {} },
  ]);
  assert.equal(piu.titolo, "3 piante da controllare");
  assert.equal(piu.testo, "Ficus lyrata · vaso bianco, Ficus lyrata · vaso nero e Begonia rex (livello dell'acqua).");

  const tante = testoPromemoria(Array.from({ length: 8 }, (_, i) => ({ pianta: pianta({ nome: `P${i}` }), stato: {} })));
  assert.equal(tante.testo, "P0, P1, P2, P3 e altre 4.");
});

test("messaggio nel formato Declarative Web Push", () => {
  const m = messaggioPush({ titolo: "T", testo: "B" }, "https://alv-bsp.github.io/piante/#/oggi", 3);
  assert.equal(m.web_push, 8030);
  assert.equal(m.notification.title, "T");
  assert.equal(m.notification.navigate, "https://alv-bsp.github.io/piante/#/oggi");
  assert.equal(m.notification.app_badge, "3");
});
