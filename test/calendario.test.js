import { test } from "node:test";
import assert from "node:assert/strict";
import { eventi, settimane } from "../src/calendario.js";

const pianta = { id: "a", nome: "Monstera", stanza: "Salotto", substrato: "terra", giorni_estate: 7, giorni_inverno: 14, creata_il: "2026-01-01T00:00:00Z", irrigazione_automatica: false };
const ciclo = { id: "k", pianta_id: "a", prodotto: "Compo", ogni_giorni: 21, dal_mese: 3, al_mese: 9, con_acqua: true, creato_il: "2026-01-01T00:00:00Z" };
const base = {
  piante: [pianta],
  ultime: new Map([["a", { ultima_bagnata: "2026-11-01T10:00:00Z" }]]),
  cicli: new Map([["a", [ciclo]]]),
  ultimeConcime: new Map(),
  cureRecenti: [{ id: "x", pianta_id: "a", tipo: "bagnata", il: "2026-11-01T10:00:00Z" }],
};

test("acqua prevista ogni N giorni dalla prossima scadenza", () => {
  const ev = eventi(base, "2026-11-01", "2026-12-31", "2026-11-05");
  const acqua = [...ev].filter(([, e]) => e.acqua.length).map(([g]) => g);
  assert.deepEqual(acqua, ["2026-11-15", "2026-11-29", "2026-12-13", "2026-12-27"]);
});

test("il concime aspetta i suoi mesi", () => {
  const ev = eventi(base, "2026-11-01", "2027-04-30", "2026-11-05");
  const conc = [...ev].filter(([, e]) => e.concime.length).map(([g]) => g);
  assert.deepEqual(conc, ["2027-03-01", "2027-03-22", "2027-04-12"]);
});

test("nel passato le cure fatte, mai le previsioni", () => {
  const ev = eventi(base, "2026-11-01", "2026-11-04", "2026-11-05");
  assert.equal(ev.get("2026-11-01").fatte.length, 1);
  assert.equal([...ev.values()].some((e) => e.acqua.length || e.concime.length), false);
});

test("irrigazione automatica: niente acqua prevista", () => {
  const ev = eventi({ ...base, piante: [{ ...pianta, irrigazione_automatica: true }] }, "2026-11-01", "2026-12-31", "2026-11-05");
  assert.equal([...ev.values()].some((e) => e.acqua.length), false);
});

test("settimane dal lunedì", () => {
  const s = settimane(2026, 11);
  assert.deepEqual(s[0], [null, null, null, null, null, null, "2026-11-01"]);
  assert.equal(s.at(-1)[0], "2026-11-30");
});
