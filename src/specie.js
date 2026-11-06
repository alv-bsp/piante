// Una foto per specie, scontornata e salvata in public/specie/ come WebP trasparente, una grande e una mini.
// Origine: Unsplash (campo `unsplash`, licenza Unsplash; crediti nel README) oppure, dove `unsplash` è null,
// una foto scelta da Alessandro (6 novembre 2026). Il fondo giallo pastello
// comune a tutte lo mette il CSS (.foto). Come sono state fatte: scripts/specie/.
//
// La specie di una pianta si ricava da tipo e nome: "Ficus lyrata", "Ficus" o "ficus lirata" danno tutti il
// Ficus lyrata. Le regole più specifiche vengono prima (variegata e adansonii prima di Monstera, Birkin prima di
// Philodendron, maculata e corallina prima di Begonia). Se nessuna regola corrisponde, niente foto: un germoglio
// disegnato sul fondo giallo.

export const SPECIE = [
  { nome: "Monstera variegata", regola: /variegat|thai|albo/, file: "monstera-variegata", unsplash: null },
  { nome: "Monstera adansonii", regola: /adansonii/, file: "monstera-adansonii", unsplash: null },
  { nome: "Monstera deliciosa", altri: ["costola d'adamo"], regola: /monstera|deliciosa/, file: "monstera-deliciosa", unsplash: null },
  { nome: "Ficus lyrata", altri: ["ficus lira", "fiddle leaf"], regola: /ficus|lyrata|lirata/, file: "ficus-lyrata", unsplash: null },
  { nome: "Strelitzia nicolai", altri: ["uccello del paradiso"], regola: /strelitzia|paradiso/, file: "strelitzia-nicolai", unsplash: null },
  { nome: "Alocasia", altri: ["orecchie d'elefante"], regola: /alocasia/, file: "alocasia", unsplash: null },
  // La maculata di casa è la forma scura: foglie quasi nere, frastagliate, a pois.
  { nome: "Begonia maculata", altri: ["begonia a pois", "polka dot"], regola: /maculata|polka/, file: "begonia-maculata", unsplash: null },
  { nome: "Begonia corallina", altri: ["ali d'angelo", "angel wing"], regola: /corallina|ali d.angelo|angel ?wing/, file: "begonia-corallina", unsplash: null },
  { nome: "Begonia rex", regola: /begonia|\brex\b/, file: "begonia-rex", unsplash: "1776548566577-4a0e2248683b" },
  { nome: "Philodendron Birkin", regola: /birkin/, file: "philodendron-birkin", unsplash: null },
  { nome: "Philodendron", regola: /philodendron|filodendr/, file: "philodendron", unsplash: "1692896315703-f700fd67c921" },
  { nome: "Pothos", altri: ["epipremnum", "potos", "epipremnum aureum"], regola: /pothos|potos|epipremnum/, file: "pothos", unsplash: "1596724878582-76f1a8fdc24f" },
  { nome: "Fittonia", altri: ["pianta mosaico"], regola: /fittonia/, file: "fittonia", unsplash: "1564227304611-80a3288811a8" },
  { nome: "Dieffenbachia", regola: /dieffenbachia|diffenbachia|difenbachia/, file: "dieffenbachia", unsplash: null },
  { nome: "Sansevieria trifasciata", altri: ["lingua di suocera", "snake plant", "dracaena trifasciata"], regola: /sansevieria|sanseveria|trifasciata|lingua di suocera|snake/, file: "sansevieria", unsplash: "1687552212914-03a30c82053c" },
  { nome: "Limone", altri: ["citrus", "citrus limon", "agrumi"], regola: /limone|citrus|agrum/, file: "limone", unsplash: "1575574202227-6b68bd6e3f29" },
  { nome: "Melo", altri: ["malus", "malus domestica", "mele"], regola: /\bmelo\b|malus|\bmele\b/, file: "melo", unsplash: null },
];

/** Specie sconosciuta: niente foto. */
export const GENERICA = { nome: "Pianta", regola: /$^/, file: null };

/** Minuscole e senza accenti, per confronti e ricerca. */
export const normalizza = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

/**
 * Specie di una pianta.
 *  1. Il tipo è il nome di una specie, o uno dei suoi altri nomi ("Citrus limon"): quella. Se però il tipo è solo
 *     il genere ("Philodendron") e il nome dice una varietà più precisa dello stesso genere ("Philodendron
 *     Birkin"), vince il nome.
 *  2. Il tipo è vuoto o è una parola sola ("Monstera", "Begonia", "Epipremnum"): la cerco in tipo e nome insieme.
 *  3. Il tipo è una specie che non conosco ("Ficus pumila", aggiunta dall'editor): niente foto, anche se il genere
 *     somiglia a una nota. Meglio nessuna foto che quella di un'altra pianta.
 */
export function specieDi(p) {
  const tipo = normalizza(p.tipo);
  const nome = normalizza(p.nome);
  const esatta = tipo && SPECIE.find((s) => normalizza(s.nome) === tipo || s.altri?.some((a) => normalizza(a) === tipo));
  if (esatta) {
    const genere = normalizza(esatta.nome).split(" ")[0];
    const piuPrecisa = SPECIE.slice(0, SPECIE.indexOf(esatta))
      .find((s) => normalizza(s.nome).startsWith(`${genere} `) && s.regola.test(nome));
    return piuPrecisa || esatta;
  }
  if (tipo.split(/\s+/).length > 1) return GENERICA;
  const testo = `${tipo} ${nome}`;
  return SPECIE.find((s) => s.regola.test(testo)) || GENERICA;
}

/** Indirizzo della foto scontornata (relativo alla pagina), o null se la specie non ne ha una. */
export function fotoSpecie(specie, formato = "carta") {
  if (!specie?.file) return null;
  return `specie/${specie.file}${formato === "mini" ? "-mini" : ""}.webp`;
}

/**
 * Ricerca per il campo Specie dell'editor. Cerca nei nomi (anche a metà parola), negli altri nomi comuni
 * ("lingua" trova la Sansevieria) e nelle regole, più i tipi che hai già usato tu e che non hanno una foto.
 * Ritorna { risultati: [{ nome, specie|null }], esiste } dove `esiste` dice se il testo è già un nome noto.
 */
export function cercaSpecie(testo, tipiMiei = []) {
  const q = normalizza(testo);
  const voci = [
    ...SPECIE.map((s) => ({ nome: s.nome, specie: s })),
    // Solo i tipi che non portano già a una specie con la foto ("Monstera" è già Monstera deliciosa).
    ...[...new Set(tipiMiei.filter(Boolean))]
      .filter((t) => specieDi({ tipo: t }) === GENERICA)
      .map((t) => ({ nome: t, specie: null })),
  ];
  const punteggio = (v) => {
    const n = normalizza(v.nome);
    if (!q) return 0;
    if (n.startsWith(q)) return 0;
    if (n.split(/\s+/).some((parola) => parola.startsWith(q))) return 1;
    if (n.includes(q)) return 2;
    // Altri nomi ("lingua di suocera"), anche scritti a metà; poi le regole ("potos", "filodendro").
    if (v.specie?.altri?.some((a) => normalizza(a).includes(q))) return 3;
    if (v.specie && q.length >= 3 && v.specie.regola.test(q)) return 3;
    return null;
  };
  const risultati = voci
    .map((v) => ({ ...v, p: punteggio(v) }))
    .filter((v) => v.p != null)
    .sort((a, b) => a.p - b.p || a.nome.localeCompare(b.nome, "it"))
    .map(({ nome, specie }) => ({ nome, specie }));
  const esiste = Boolean(q) && voci.some((v) => normalizza(v.nome) === q);
  return { risultati, esiste };
}
