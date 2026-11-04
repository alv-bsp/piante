// Piante di partenza, dalle schede che conosco già (memoria, settembre–novembre 2026). Si caricano una volta
// dall'app quando l'elenco è vuoto; dopo si modificano nell'app. Le stanze che non conosco restano
// "Da sistemare": aprila e scegli la stanza giusta.
// Intervalli in giorni (estate = aprile–settembre, inverno = ottobre–marzo): sono il momento in cui l'app
// ti dice di CONTROLLARE, non di bagnare per forza. Se trovi il terriccio ancora umido, tocca "Ancora umida".

const DA_SISTEMARE = "Da sistemare";

export const PIANTE_DI_PARTENZA = [
  {
    nome: "Monstera deliciosa", tipo: "Monstera", stanza: "Salotto mansarda", vaso: "Vaso nero su supporto con gambe",
    giorni_estate: 7, giorni_inverno: 14,
    note: "Bagna quando i primi 4-5 cm di terriccio sono asciutti. Moss pole: spruzza lo sfagno ogni 1-2 giorni.",
  },
  {
    nome: "Monstera variegata", tipo: "Monstera", stanza: DA_SISTEMARE,
    giorni_estate: 7, giorni_inverno: 14,
    note: "Più delicata della deliciosa: le parti bianche non fanno fotosintesi.",
  },
  {
    nome: "Monstera adansonii", tipo: "Monstera", stanza: DA_SISTEMARE, vaso: "Vaso bianco con moss pole",
    giorni_estate: 6, giorni_inverno: 12,
    note: "Tieni umido il moss pole con lo spruzzino.",
  },
  {
    nome: "Ficus lyrata", tipo: "Ficus", stanza: "Salotto", vaso: "Vaso bianco con gambe",
    giorni_estate: 7, giorni_inverno: 14,
    note: "Lascia asciugare bene tra un'annaffiatura e l'altra: il terriccio umido porta sciaridi e funghi.",
  },
  {
    nome: "Ficus lyrata (secondo)", tipo: "Ficus", stanza: "Salotto",
    giorni_estate: 7, giorni_inverno: 14,
    note: "Quello con gli sciaridi: bagna solo a terriccio asciutto, lapillo in superficie.",
  },
  {
    nome: "Strelitzia nicolai", tipo: "Strelitzia", stanza: DA_SISTEMARE, vaso: "Vaso beige decorato, 3 fusti",
    giorni_estate: 6, giorni_inverno: 12,
    note: "Annaffiatura profonda fino a sgocciolamento quando i primi 3-4 cm sono asciutti, poi svuota il sottovaso. Mai poca acqua spesso.",
  },
  {
    nome: "Alocasia", tipo: "Alocasia", stanza: DA_SISTEMARE,
    giorni_estate: 7, giorni_inverno: 21,
    note: "In dormienza: acqua al minimo, controlla che il cormo sia sodo.",
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
  },
  {
    nome: "Begonia maculata", tipo: "Begonia", stanza: DA_SISTEMARE,
    giorni_estate: 5, giorni_inverno: 9,
  },
  {
    nome: "Philodendron", tipo: "Philodendron", stanza: DA_SISTEMARE,
    giorni_estate: 7, giorni_inverno: 12,
  },
  {
    nome: "Pothos", tipo: "Epipremnum", stanza: DA_SISTEMARE, vaso: "Sullo scaffale, ricadente",
    giorni_estate: 8, giorni_inverno: 14,
  },
  {
    nome: "Fittonia", tipo: "Fittonia", stanza: DA_SISTEMARE,
    giorni_estate: 3, giorni_inverno: 5,
    note: "Quando ha sete si affloscia, si riprende in un'ora. Umidità alta, niente sole diretto.",
  },
].map((p) => ({ substrato: "terra", vaso: null, note: null, ...p }));
