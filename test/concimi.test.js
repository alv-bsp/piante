import { test } from "node:test";
import assert from "node:assert/strict";
import { concimeConsigliato, programmaDi, stessiCicli, PROGRAMMI } from "../src/concimi.js";
import { PIANTE_DI_PARTENZA } from "../src/partenza.js";

const pianta = (nome, tipo, extra = {}) => ({ nome, tipo, substrato: "terra", irrigazione_automatica: false, ...extra });

test("la specie decide il programma", () => {
  assert.equal(programmaDi(pianta("Dieffenbachia", "Dieffenbachia")).chiave, "verdi");
  assert.equal(programmaDi(pianta("Sansevieria", "Sansevieria trifasciata")).chiave, "succulente");
  assert.equal(programmaDi(pianta("Begonia corallina", "Begonia corallina")).chiave, "fiorite");
  assert.equal(programmaDi(pianta("Limone", "Citrus limon")).chiave, "agrumi");
  assert.equal(programmaDi(pianta("Melo", "Malus domestica")).chiave, "frutto");
  assert.equal(programmaDi(pianta("Boh", "")).chiave, "verdi");               // sconosciuta: piante verdi
});

test("ritocchi della specie, idroponica e irrigazione automatica", () => {
  const [alocasia] = concimeConsigliato(pianta("Alocasia", "Alocasia"));
  assert.deepEqual([alocasia.ogni_giorni, alocasia.dal_mese, alocasia.al_mese], [28, 5, 8]);
  const [idro] = concimeConsigliato(pianta("Begonia rex (idroponica)", "Begonia", { substrato: "idroponica" }));
  assert.equal(idro.prodotto, "Concime per idrocoltura");
  const limone = concimeConsigliato(pianta("Limone", "Citrus limon", { irrigazione_automatica: true }));
  assert.equal(limone.length, 2);
  assert.ok(limone.every((c) => !c.con_acqua));
});

test("le specie aggiunte da te usano il loro programma", () => {
  const mie = [{ nome: "Calathea", concime: "fiorite" }, { nome: "Echeveria", concime: "succulente" }];
  assert.equal(programmaDi(pianta("Calathea in sala", "calathea"), mie).chiave, "fiorite");
  assert.equal(programmaDi(pianta("Echeveria", "Echeveria"), mie).chiave, "succulente");
  assert.equal(concimeConsigliato(pianta("X", "Felce"), [{ nome: "Felce", concime: "nessuno" }]).length, 0);
});

test("le piante di partenza hanno già il concime consigliato (stessi prodotti, frequenze e mesi)", () => {
  for (const p of PIANTE_DI_PARTENZA) {
    if (!p.cicli?.length) continue; // la Begonia in idroponica non aveva concime
    assert.ok(stessiCicli(p.cicli, concimeConsigliato(p)), p.nome);
  }
});

test("programmi coerenti", () => {
  for (const [chiave, prog] of Object.entries(PROGRAMMI)) {
    for (const c of prog.cicli) {
      assert.ok(c.prodotto && c.ogni_giorni > 0 && c.dal_mese >= 1 && c.al_mese <= 12, chiave);
    }
  }
});
