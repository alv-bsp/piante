// Piante di partenza, dalle schede che conosco già (memoria, settembre–novembre 2026). Si caricano una volta
// dall'app quando l'elenco è vuoto; dopo si modificano nell'app. Le stanze che non conosco restano
// "Da sistemare": aprila e scegli la stanza giusta.
//
// Acqua: intervalli in giorni (estate = aprile–settembre, inverno = ottobre–marzo). Sono il momento in cui l'app
// ti dice di CONTROLLARE, non di bagnare per forza: se il terriccio è ancora umido, tocca "Ancora umida".
// Melo e limone li irriga Home Assistant: nessun promemoria per l'acqua, solo per il concime.
//
// Concime: cicli da confrontare con l'etichetta dei prodotti. Le piante di casa lo prendono sciolto nell'acqua
// (Compo liquido piante verdi) da marzo a settembre; d'inverno sono a riposo.

const DA_SISTEMARE = "Da sistemare";

const compo = (ogni_giorni, note = null) => ({
  prodotto: "Compo liquido piante verdi", ogni_giorni, dal_mese: 3, al_mese: 9, con_acqua: true, note,
});

export const PIANTE_DI_PARTENZA = [
  {
    nome: "Monstera deliciosa", tipo: "Monstera", stanza: "Salotto mansarda", vaso: "Vaso nero su supporto con gambe",
    giorni_estate: 7, giorni_inverno: 14,
    note: "Bagna quando i primi 4-5 cm di terriccio sono asciutti. Moss pole: spruzza lo sfagno ogni 1-2 giorni.",
    cicli: [compo(21, "In pausa finché c'è il trattamento contro i tripidi")],
  },
  {
    nome: "Monstera variegata", tipo: "Monstera", stanza: DA_SISTEMARE,
    giorni_estate: 7, giorni_inverno: 14,
    note: "Più delicata della deliciosa: le parti bianche non fanno fotosintesi.",
    cicli: [compo(21, "Metà dose")],
  },
  {
    nome: "Monstera adansonii", tipo: "Monstera", stanza: DA_SISTEMARE, vaso: "Vaso bianco con moss pole",
    giorni_estate: 6, giorni_inverno: 12,
    note: "Tieni umido il moss pole con lo spruzzino.",
    cicli: [compo(21)],
  },
  {
    nome: "Ficus lyrata", tipo: "Ficus", stanza: "Salotto", vaso: "Vaso bianco con gambe",
    giorni_estate: 7, giorni_inverno: 14,
    note: "Lascia asciugare bene tra un'annaffiatura e l'altra: il terriccio umido porta sciaridi e funghi.",
    cicli: [compo(21)],
  },
  {
    nome: "Ficus lyrata (secondo)", tipo: "Ficus", stanza: "Salotto",
    giorni_estate: 7, giorni_inverno: 14,
    note: "Quello con gli sciaridi: bagna solo a terriccio asciutto, lapillo in superficie.",
    cicli: [compo(21)],
  },
  {
    nome: "Strelitzia nicolai", tipo: "Strelitzia", stanza: DA_SISTEMARE, vaso: "Vaso beige decorato, 3 fusti",
    giorni_estate: 6, giorni_inverno: 12,
    note: "Annaffiatura profonda fino a sgocciolamento quando i primi 3-4 cm sono asciutti, poi svuota il sottovaso. Mai poca acqua spesso.",
    cicli: [compo(21)],
  },
  {
    nome: "Alocasia", tipo: "Alocasia", stanza: DA_SISTEMARE,
    giorni_estate: 7, giorni_inverno: 21,
    note: "In dormienza: acqua al minimo, controlla che il cormo sia sodo.",
    cicli: [{ ...compo(28, "Solo se è ripartita con foglie nuove"), dal_mese: 5, al_mese: 8 }],
  },
  {
    nome: "Begonia rex (idroponica)", tipo: "Begonia", stanza: "Camera", substrato: "idroponica",
    giorni_estate: 7, giorni_inverno: 10,
    note: "Rabbocca quando il livello scende sotto il minimo.",
  },
  {
    nome: "Begonia rex", tipo: "Begonia", stanza: "Camera",
    giorni_estate: 5, giorni_inverno: 9,
    note: "Zero sole diretto. Bagna alla base, mai sulle foglie.",
    cicli: [compo(28)],
  },
  {
    nome: "Begonia maculata", tipo: "Begonia", stanza: DA_SISTEMARE,
    giorni_estate: 5, giorni_inverno: 9,
    cicli: [compo(28)],
  },
  {
    nome: "Philodendron", tipo: "Philodendron", stanza: DA_SISTEMARE,
    giorni_estate: 7, giorni_inverno: 12,
    cicli: [compo(21)],
  },
  {
    nome: "Pothos", tipo: "Epipremnum", stanza: DA_SISTEMARE, vaso: "Sullo scaffale, ricadente",
    giorni_estate: 8, giorni_inverno: 14,
    cicli: [compo(28)],
  },
  {
    nome: "Fittonia", tipo: "Fittonia", stanza: DA_SISTEMARE,
    giorni_estate: 3, giorni_inverno: 5,
    note: "Quando ha sete si affloscia, si riprende in un'ora. Umidità alta, niente sole diretto.",
    cicli: [compo(28, "Metà dose")],
  },
  {
    nome: "Melo", tipo: "Malus domestica", stanza: "Terrazzo", vaso: "Terracotta, 40-50 litri",
    irrigazione_automatica: true,
    note: "Pieno sole. A maggio dirada i frutticini: al massimo 2-4 frutti.",
    cicli: [
      { prodotto: "Sangue di bue Flortis", ogni_giorni: 30, dal_mese: 4, al_mese: 5, con_acqua: false,
        note: "Fase vegetativa. Niente azoto dopo giugno" },
      { prodotto: "Fortigo Frutti Bio", ogni_giorni: 15, dal_mese: 6, al_mese: 8, con_acqua: false,
        note: "Fruttificazione. Stop a settembre, il legno deve maturare" },
    ],
  },
  {
    nome: "Limone", tipo: "Citrus limon", stanza: "Terrazzo superiore",
    irrigazione_automatica: true,
    note: "Non far mai asciugare del tutto il pane di terra. Sotto i -2 °C proteggilo (TNT doppio o veranda).",
    cicli: [
      { prodotto: "Granulare per agrumi", ogni_giorni: 92, dal_mese: 3, al_mese: 9, con_acqua: false,
        note: "Tre volte l'anno: marzo, giugno, settembre" },
      { prodotto: "Chelato di ferro EDDHA", ogni_giorni: 30, dal_mese: 4, al_mese: 9, con_acqua: false,
        note: "Contro la clorosi: toglilo quando le foglie nuove sono verdi" },
    ],
  },
].map((p) => ({
  substrato: "terra", vaso: null, note: null, irrigazione_automatica: false, giorni_estate: 7, giorni_inverno: 14, ...p,
}));
