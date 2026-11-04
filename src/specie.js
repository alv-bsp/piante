// Una foto generica per specie, da Unsplash (licenza Unsplash: uso libero, anche senza attribuzione; i crediti
// sono comunque nel README). Le immagini restano sul CDN di Unsplash, che le ritaglia e le ridimensiona al volo.
//
// La specie di una pianta si ricava da tipo e nome: "Ficus lyrata", "Ficus" o "ficus lirata" danno tutti il
// Ficus lyrata. Le regole più specifiche vengono prima (variegata e adansonii prima di Monstera, maculata prima
// di Begonia). Se nessuna regola corrisponde, una foto generica.

export const SPECIE = [
  { nome: "Monstera variegata", regola: /variegat|thai|albo/, foto: "1640039986048-885b4234b749" },
  { nome: "Monstera adansonii", regola: /adansonii/, foto: "1695219912635-c873f773b69a" },
  { nome: "Monstera deliciosa", regola: /monstera|deliciosa/, foto: "1637967885705-a60e3fea266d" },
  { nome: "Ficus lyrata", regola: /ficus|lyrata|lirata/, foto: "1545239705-1564e58b9e4a" },
  { nome: "Strelitzia nicolai", regola: /strelitzia|paradiso/, foto: "1731486744843-c7ecce11a707" },
  { nome: "Alocasia", regola: /alocasia/, foto: "1650522462224-e2d6f7e9bcbe" },
  { nome: "Begonia maculata", regola: /maculata/, foto: "1600958004829-16421f144fd0" },
  { nome: "Begonia rex", regola: /begonia|\brex\b/, foto: "1776548566577-4a0e2248683b" },
  { nome: "Philodendron", regola: /philodendron|filodendro/, foto: "1692896315703-f700fd67c921" },
  { nome: "Pothos", regola: /pothos|potos|epipremnum/, foto: "1596724878582-76f1a8fdc24f" },
  { nome: "Fittonia", regola: /fittonia/, foto: "1564227304611-80a3288811a8" },
  { nome: "Limone", regola: /limone|citrus|agrum/, foto: "1763066696319-d1093663bbd2" },
  { nome: "Melo", regola: /\bmelo\b|malus|\bmele\b/, foto: "1598639308970-099032f8cf9b" },
];

export const GENERICA = { nome: "Pianta", regola: /$^/, foto: "1700213040248-254e9267dd3e" };

/** Specie di una pianta: prima il tipo da solo (è quello che scegli nell'editor), poi tipo e nome insieme. */
export function specieDi(p) {
  const tipo = (p.tipo || "").toLowerCase();
  const esatta = SPECIE.find((s) => s.nome.toLowerCase() === tipo);
  if (esatta) return esatta;
  const testo = `${tipo} ${(p.nome || "").toLowerCase()}`;
  return SPECIE.find((s) => s.regola.test(testo)) || GENERICA;
}

/** Indirizzo della foto ritagliata: miniatura quadrata, carta o copertina. Doppia densità per gli schermi retina. */
export function fotoSpecie(specie, formato = "carta") {
  const [w, h] = { mini: [96, 96], carta: [640, 420], copertina: [900, 760], scelta: [160, 160] }[formato];
  return `https://images.unsplash.com/photo-${specie.foto}?w=${w}&h=${h}&fit=crop&crop=entropy&auto=format&q=70&dpr=2`;
}
