// Eventi del calendario, giorno per giorno.
//   passato: le cure segnate (stato.cureRecenti, ultimi due mesi)
//   futuro:  le scadenze previste, ripetute ogni N giorni come se le facessi in tempo
// Oggi non passa da qui: la pagina mostra le carte "da controllare" e "da concimare" di daFareOggi().
import {
  aggiungiGiorni, giornoRoma, intervallo, nelMese, statoCiclo, statoPianta,
} from "../supabase/functions/_shared/scadenze.js";

const mese = (giorno) => Number(giorno.slice(5, 7));

/** Primo giorno, dopo `giorno`, in cui il ciclo rientra nei suoi mesi. */
function prossimoInizio(ciclo, giorno) {
  let d = giorno;
  for (let i = 0; i < 13 && !nelMese(ciclo, mese(d)); i++) d = `${aggiungiGiorni(`${d.slice(0, 7)}-28`, 4).slice(0, 7)}-01`;
  return d;
}

/**
 * Mappa giorno (AAAA-MM-GG) → { acqua: [pianta], concime: [{ pianta, ciclo }], fatte: [cura] } tra `da` e `a` inclusi.
 * `cicli` è la Map pianta_id → [ciclo], `ultimeConcime` la Map ciclo_id → istante.
 */
export function eventi({ piante, ultime, cicli, ultimeConcime, cureRecenti }, da, a, oggi = giornoRoma()) {
  const giorni = new Map();
  const di = (g) => {
    if (!giorni.has(g)) giorni.set(g, { acqua: [], concime: [], fatte: [] });
    return giorni.get(g);
  };
  const attive = piante.filter((p) => !p.archiviata_il);
  const domani = aggiungiGiorni(oggi, 1);

  for (const p of attive) {
    // Acqua: dalla prossima scadenza in poi (le scadute di oggi le mostra già la pagina).
    if (!p.irrigazione_automatica) {
      const st = statoPianta(p, ultime.get(p.id), oggi);
      let g = st.daControllare ? aggiungiGiorni(oggi, intervallo(p, oggi)) : st.scadenza;
      for (let i = 0; i < 60 && g <= a; i++) {
        if (g >= da && g >= domani) di(g).acqua.push(p);
        g = aggiungiGiorni(g, intervallo(p, g));
      }
    }
    // Concime: dentro i mesi del ciclo, ogni N giorni.
    for (const c of cicli.get(p.id) || []) {
      const cs = statoCiclo(c, ultimeConcime.get(c.id), oggi);
      let g = cs.attivo ? (cs.daFare ? aggiungiGiorni(oggi, c.ogni_giorni) : cs.scadenza) : prossimoInizio(c, domani);
      for (let i = 0; i < 60 && g <= a; i++) {
        if (!nelMese(c, mese(g))) {
          g = prossimoInizio(c, g);
          continue;
        }
        if (g >= da && g >= domani) di(g).concime.push({ pianta: p, ciclo: c });
        g = aggiungiGiorni(g, c.ogni_giorni);
      }
    }
  }

  // Passato: quello che hai fatto davvero.
  const perId = new Map(piante.map((p) => [p.id, p]));
  for (const c of cureRecenti) {
    const g = giornoRoma(c.il);
    if (g < da || g > a || g >= oggi || !perId.has(c.pianta_id)) continue;
    di(g).fatte.push({ ...c, pianta: perId.get(c.pianta_id) });
  }
  return giorni;
}

/** Le settimane del mese (lunedì per primo): array di 7 giorni AAAA-MM-GG, null fuori dal mese. */
export function settimane(anno, m) {
  const primo = `${anno}-${String(m).padStart(2, "0")}-01`;
  const giorniNelMese = new Date(Date.UTC(anno, m, 0)).getUTCDate();
  const vuoti = (new Date(Date.UTC(anno, m - 1, 1)).getUTCDay() + 6) % 7;
  const celle = [...Array(vuoti).fill(null), ...Array.from({ length: giorniNelMese }, (_, i) => aggiungiGiorni(primo, i))];
  while (celle.length % 7) celle.push(null);
  return Array.from({ length: celle.length / 7 }, (_, i) => celle.slice(i * 7, i * 7 + 7));
}
