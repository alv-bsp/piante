// Il concime lo decide la specie. Pochi programmi generici, gli stessi prodotti che usi già, e per ogni specie
// quale programma usare (con qualche ritocco: più rado, mesi più corti, metà dose). L'editor lo compila da solo
// quando scegli la specie; restano cicli normali, che puoi cambiare.
//
// Regole in più: in idroponica il concime è quello da idrocoltura, sciolto nel rabbocco; con l'irrigazione
// automatica niente è "sciolto nell'acqua" (l'acqua la dà Home Assistant).
import { specieDi, normalizza, GENERICA } from "./specie.js";

const ciclo = (prodotto, ogni_giorni, dal_mese, al_mese, con_acqua, note = "") =>
  ({ prodotto, ogni_giorni, dal_mese, al_mese, con_acqua, note });

/** Programmi di concimazione. `scelta`: si può scegliere per una specie aggiunta da te. */
export const PROGRAMMI = {
  verdi: { nome: "Piante verdi", scelta: true, cicli: [ciclo("Compo liquido piante verdi", 21, 3, 9, true)] },
  fiorite: { nome: "Piante fiorite", scelta: true, cicli: [ciclo("Concime liquido piante fiorite", 14, 3, 9, true)] },
  succulente: {
    nome: "Succulente", scelta: true,
    cicli: [ciclo("Concime per cactus e succulente", 42, 4, 9, true, "Metà dose")],
  },
  agrumi: {
    nome: "Agrumi", scelta: true,
    cicli: [
      ciclo("Granulare per agrumi", 92, 3, 9, false, "Tre volte l'anno: marzo, giugno, settembre"),
      ciclo("Chelato di ferro EDDHA", 30, 4, 9, false, "Contro la clorosi: toglilo quando le foglie nuove sono verdi"),
    ],
  },
  frutto: {
    nome: "Alberi da frutto", scelta: true,
    cicli: [
      ciclo("Sangue di bue Flortis", 30, 4, 5, false, "Fase vegetativa. Niente azoto dopo giugno"),
      ciclo("Fortigo Frutti Bio", 15, 6, 8, false, "Fruttificazione. Stop a settembre, il legno deve maturare"),
    ],
  },
  idrocoltura: {
    nome: "Idrocoltura", scelta: false,
    cicli: [ciclo("Concime per idrocoltura", 28, 3, 9, true, "Nell'acqua del rabbocco")],
  },
  nessuno: { nome: "Nessun concime", scelta: true, cicli: [] },
};

/** Programma per specie, con i ritocchi. Le stesse scelte delle piante di partenza (partenza.js). */
const PER_SPECIE = {
  "Monstera variegata": ["verdi", { note: "Metà dose: le parti bianche non fanno fotosintesi" }],
  "Monstera adansonii": ["verdi"],
  "Monstera deliciosa": ["verdi"],
  "Ficus lyrata": ["verdi"],
  "Strelitzia nicolai": ["verdi"],
  "Alocasia": ["verdi", { ogni_giorni: 28, dal_mese: 5, al_mese: 8, note: "Solo se è ripartita con foglie nuove" }],
  "Begonia maculata": ["verdi", { ogni_giorni: 28 }],
  "Begonia corallina": ["fiorite", { ogni_giorni: 21 }],
  "Begonia rex": ["verdi", { ogni_giorni: 28 }],
  "Philodendron Birkin": ["verdi"],
  "Philodendron": ["verdi"],
  "Pothos": ["verdi", { ogni_giorni: 28 }],
  "Fittonia": ["verdi", { ogni_giorni: 28, note: "Metà dose" }],
  "Dieffenbachia": ["verdi"],
  "Sansevieria trifasciata": ["succulente"],
  "Limone": ["agrumi"],
  "Melo": ["frutto"],
};

/**
 * Programma della pianta: dalla specie nota, oppure dalla specie che hai aggiunto tu (`specieMie`, righe
 * { nome, concime }), oppure piante verdi. In idroponica, idrocoltura (tranne agrumi e alberi da frutto).
 */
export function programmaDi(p, specieMie = []) {
  const specie = specieDi(p);
  let chiave = "verdi";
  let ritocchi = {};
  if (specie !== GENERICA) [chiave, ritocchi = {}] = PER_SPECIE[specie.nome] || ["verdi"];
  else {
    const mia = specieMie.find((s) => normalizza(s.nome) === normalizza(p.tipo));
    if (mia && PROGRAMMI[mia.concime]) chiave = mia.concime;
  }
  if (p.substrato === "idroponica" && (chiave === "verdi" || chiave === "fiorite" || chiave === "succulente")) {
    chiave = "idrocoltura";
    ritocchi = {};
  }
  return { chiave, nome: PROGRAMMI[chiave].nome, ritocchi };
}

/** I cicli consigliati per la pianta, pronti per la bozza dell'editor. */
export function concimeConsigliato(p, specieMie = []) {
  const { chiave, ritocchi } = programmaDi(p, specieMie);
  return PROGRAMMI[chiave].cicli.map((c) => ({
    ...c,
    ...(PROGRAMMI[chiave].cicli.length === 1 ? ritocchi : {}),
    con_acqua: c.con_acqua && !p.irrigazione_automatica,
  }));
}

const firma = (cicli) =>
  JSON.stringify(cicli.map((c) => [c.prodotto.trim(), c.ogni_giorni, c.dal_mese, c.al_mese, Boolean(c.con_acqua)]).sort());

/** I cicli sono gli stessi (prodotto, frequenza, mesi, nell'acqua)? Le note non contano. */
export const stessiCicli = (a, b) => firma(a) === firma(b);
