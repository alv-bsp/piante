import { test } from "node:test";
import assert from "node:assert/strict";
import { specieDi, fotoSpecie, GENERICA } from "../src/specie.js";

const di = (nome, tipo = null) => specieDi({ nome, tipo }).nome;

test("le piante di partenza trovano la loro specie", () => {
  assert.equal(di("Monstera deliciosa", "Monstera"), "Monstera deliciosa");
  assert.equal(di("Monstera variegata", "Monstera"), "Monstera variegata");
  assert.equal(di("Monstera adansonii", "Monstera"), "Monstera adansonii");
  assert.equal(di("Ficus lyrata (secondo)", "Ficus"), "Ficus lyrata");
  assert.equal(di("Strelitzia nicolai", "Strelitzia"), "Strelitzia nicolai");
  assert.equal(di("Alocasia", "Alocasia"), "Alocasia");
  assert.equal(di("Begonia rex (idroponica)", "Begonia"), "Begonia rex");
  assert.equal(di("Begonia maculata", "Begonia"), "Begonia maculata");
  assert.equal(di("Philodendron", "Philodendron"), "Philodendron");
  assert.equal(di("Pothos", "Epipremnum"), "Pothos");
  assert.equal(di("Fittonia", "Fittonia"), "Fittonia");
  assert.equal(di("Melo", "Malus domestica"), "Melo");
  assert.equal(di("Limone", "Citrus limon"), "Limone");
});

test("il tipo scelto nell'editor vince sul nome", () => {
  assert.equal(di("La mia pianta grande", "Ficus lyrata"), "Ficus lyrata");
  assert.equal(di("Ficus della camera", "Begonia maculata"), "Begonia maculata");
});

test("scritture diverse e specie sconosciute", () => {
  assert.equal(di("ficus lirata"), "Ficus lyrata");
  assert.equal(di("Uccello del paradiso"), "Strelitzia nicolai");
  assert.equal(di("Pomelo"), GENERICA.nome);          // "melo" dentro un'altra parola non conta
  assert.equal(di("Calathea", "Calathea"), GENERICA.nome);
});

test("indirizzo della foto ritagliata", () => {
  const url = fotoSpecie(specieDi({ nome: "Ficus lyrata" }), "mini");
  assert.match(url, /^https:\/\/images\.unsplash\.com\/photo-1545239705-1564e58b9e4a\?w=96&h=96&fit=crop/);
});
