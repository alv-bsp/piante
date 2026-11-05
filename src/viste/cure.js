// Azioni Bagnata / Ancora umida / Concimata, uguali nel Calendario, in Casa e nella scheda.
// Un tocco segna, il toast permette di annullare tutto quello che quel tocco ha segnato.
import { stato, trovaPianta, concimeInAcqua } from "../stato.js";
import { registraCura, registraConcime, annullaCure, mezzogiorno } from "../dati.js";
import { toast } from "../ui/avvisi.js";
import { vibra, schizzi, zeta, saltello, lampo, congeda } from "../ui/effetti.js";
import { giornoRoma } from "../../supabase/functions/_shared/scadenze.js";
import { verbi } from "./comuni.js";

const inCorso = new Set();

/**
 * Effetti al tocco, subito, senza aspettare il server: vibrazione, schizzi dal pulsante, la mascotte che salta,
 * la carta di oggi che se ne va. Ritorna cosa fare se il salvataggio fallisce.
 */
function alTocco(el, effetto) {
  vibra();
  if (effetto === "acqua" || effetto === "concime") schizzi(el, effetto, { forza: el.classList.contains("tasto-grande") ? 1.25 : 1 });
  if (effetto === "acqua+concime") {
    schizzi(el, "acqua", { forza: 1.25 });
    schizzi(el, "concime", { quante: 6 });
  }
  if (effetto === "riposo") zeta(el);
  const mascotte = document.querySelector("#app .ritratto-mascotte svg");
  if (mascotte) saltello(mascotte);
  return congeda(el.closest(".carte > .carta"));
}

/** Dopo il salvataggio la pagina è già ridisegnata: un lampo verde sulla riga della pianta, se c'è. */
function dopo(id) {
  const riga = document.querySelector(`#app .riga-pianta [data-id="${id}"]`)?.closest(".riga-pianta");
  lampo(riga);
}

/** Esegue `salva` una volta per pianta alla volta, poi mostra il toast con Annulla. */
async function segna(el, salva, testo, effetto) {
  const p = trovaPianta(el.dataset.id);
  if (!p || inCorso.has(p.id)) return;
  inCorso.add(p.id);
  el.setAttribute("aria-busy", "true");
  const rimetti = alTocco(el, effetto);
  try {
    const righe = await salva(p);
    dopo(p.id);
    toast(testo(p), { azione: () => annulla(righe) });
  } catch (e) {
    console.error("cura", e);
    rimetti();
    toast(navigator.onLine ? "Non sono riuscito a salvarlo. Riprova." : "Sei offline: riprova quando c'è rete.");
  } finally {
    inCorso.delete(p.id);
    el.removeAttribute?.("aria-busy");
  }
}

export async function annulla(righe) {
  try {
    await annullaCure(righe);
    toast("Annullato.");
  } catch (e) {
    console.error("annulla", e);
    toast("Non sono riuscito ad annullare. Riprova dallo storico della pianta.");
  }
}

const cicloDi = (p, id) => (stato.cicli.get(p.id) || []).find((c) => c.id === id);

export const azioni = {
  bagnata: (el) => segna(el, (p) => registraCura(p, "bagnata"), (p) => `${p.nome}: ${verbi(p).fatta}.`, "acqua"),
  umida: (el) => segna(el, (p) => registraCura(p, "controllata"), (p) => `${p.nome}: ricontrollo tra qualche giorno.`, "riposo"),
  /** Bagnata con il concime sciolto nell'acqua: segna l'annaffiatura e i concimi in sospeso. */
  "bagnata-concime": (el) => segna(
    el,
    (p) => registraConcime(p, concimeInAcqua(p), { conAcqua: true }),
    (p) => `${p.nome}: ${verbi(p).fatta} con il concime.`,
    "acqua+concime",
  ),
  /** Un ciclo di concime fatto (dalla carta in Oggi o dalla scheda). Se va nell'acqua, è anche un'annaffiatura. */
  concimata: (el) => segna(
    el,
    (p) => {
      const c = cicloDi(p, el.dataset.ciclo);
      if (!c) throw new Error("ciclo non trovato");
      return registraConcime(p, [c], { conAcqua: c.con_acqua && !p.irrigazione_automatica });
    },
    (p) => `${p.nome}: ${cicloDi(p, el.dataset.ciclo)?.prodotto || "concime"} segnato.`,
    "concime",
  ),
  /** Bagnata un altro giorno (scheda): legge la data dal campo accanto. */
  "bagnata-il": (el) => {
    const campo = document.getElementById("altro-giorno");
    const giorno = campo?.value;
    if (!giorno) return toast("Scegli il giorno.");
    if (giorno > giornoRoma()) return toast("Il giorno non può essere nel futuro.");
    segna(el, (p) => registraCura(p, "bagnata", mezzogiorno(giorno)), (p) => `${p.nome}: ${verbi(p).fatta} il ${giorno.split("-").reverse().join("/")}.`, "acqua");
  },
};
