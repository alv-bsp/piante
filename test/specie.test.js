import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { specieDi, fotoSpecie, cercaSpecie, SPECIE, GENERICA } from "../src/specie.js";

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

test("le specie nuove", () => {
  assert.equal(di("Birkin"), "Philodendron Birkin");
  assert.equal(di("Philodendron Birkin", "Philodendron"), "Philodendron Birkin");
  assert.equal(di("Begonia corallina", "Begonia"), "Begonia corallina");
  assert.equal(di("Dieffenbachia"), "Dieffenbachia");
  assert.equal(di("Lingua di suocera"), "Sansevieria trifasciata");
  assert.equal(di("Sansevieria", "Sansevieria trifasciata"), "Sansevieria trifasciata");
});

test("il tipo scelto nell'editor vince sul nome", () => {
  assert.equal(di("La mia pianta grande", "Ficus lyrata"), "Ficus lyrata");
  assert.equal(di("Ficus della camera", "Begonia maculata"), "Begonia maculata");
  assert.equal(di("Quella in sala", "dieffenbachia"), "Dieffenbachia"); // maiuscole e minuscole non contano
});

test("scritture diverse e specie sconosciute", () => {
  assert.equal(di("ficus lirata"), "Ficus lyrata");
  assert.equal(di("Uccello del paradiso"), "Strelitzia nicolai");
  assert.equal(di("Pomelo"), GENERICA.nome);          // "melo" dentro un'altra parola non conta
  assert.equal(di("Calathea", "Calathea"), GENERICA.nome);
  assert.equal(di("Ficus pumila", "Ficus pumila"), GENERICA.nome);  // specie nuova: niente foto di un altro ficus
  assert.equal(di("Ficus grande", "Ficus"), "Ficus lyrata");        // il solo genere sì
});

test("foto: file locali, mini e grande; niente foto per le specie sconosciute", () => {
  assert.equal(fotoSpecie(specieDi({ nome: "Ficus lyrata" }), "mini"), "specie/ficus-lyrata-mini.webp");
  assert.equal(fotoSpecie(specieDi({ nome: "Ficus lyrata" }), "copertina"), "specie/ficus-lyrata.webp");
  assert.equal(fotoSpecie(GENERICA), null);
  for (const s of SPECIE) {
    for (const f of [`public/specie/${s.file}.webp`, `public/specie/${s.file}-mini.webp`]) assert.ok(existsSync(f), f);
  }
});

test("ricerca della specie mentre scrivi", () => {
  const nomi = (q, miei) => cercaSpecie(q, miei).risultati.map((r) => r.nome);
  assert.deepEqual(nomi("begonia"), ["Begonia corallina", "Begonia maculata", "Begonia rex"]);
  assert.equal(nomi("mon")[0], "Monstera adansonii");
  assert.ok(nomi("birk").includes("Philodendron Birkin"));          // a metà nome
  assert.deepEqual(nomi("lingua di suocera"), ["Sansevieria trifasciata"]); // nome comune
  assert.deepEqual(nomi("lingua"), ["Sansevieria trifasciata"]);            // anche a metà
  assert.deepEqual(nomi("paradiso"), ["Strelitzia nicolai"]);
  assert.ok(nomi("calat", ["Calathea"]).includes("Calathea"));      // i tipi che hai già usato
  assert.ok(!nomi("mon", ["Monstera"]).includes("Monstera"));       // ma non quelli che hanno già la foto
  assert.equal(nomi("").length, SPECIE.length);                      // vuoto: tutte
  assert.equal(cercaSpecie("Ficus lyrata").esiste, true);
  assert.equal(cercaSpecie("ficus").esiste, false);
  assert.equal(cercaSpecie("Calathea").esiste, false);
  assert.equal(cercaSpecie("calathea", ["Calathea"]).esiste, true);
});
