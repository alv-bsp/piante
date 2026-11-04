// Azioni Bagnata / Ancora umida / Concimata, uguali in Oggi, Casa e nella scheda.
// Un tocco segna, il toast permette di annullare tutto quello che quel tocco ha segnato.
import { stato, trovaPianta, concimeInAcqua } from "../stato.js";
import { registraCura, registraConcime, annullaCure, mezzogiorno } from "../dati.js";
import { toast } from "../ui/avvisi.js";
import { giornoRoma } from "../../supabase/functions/_shared/scadenze.js";
import { verbi } from "./comuni.js";

const inCorso = new Set();

/** Esegue `salva` una volta per pianta alla volta, poi mostra il toast con Annulla. */
async function segna(el, salva, testo) {
  const p = trovaPianta(el.dataset.id);
  if (!p || inCorso.has(p.id)) return;
  inCorso.add(p.id);
  el.setAttribute("aria-busy", "true");
  try {
    const righe = await salva(p);
    toast(testo(p), { azione: () => annulla(righe) });
  } catch (e) {
    console.error("cura", e);
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
  bagnata: (el) => segna(el, (p) => registraCura(p, "bagnata"), (p) => `${p.nome}: ${verbi(p).fatta}.`),
  umida: (el) => segna(el, (p) => registraCura(p, "controllata"), (p) => `${p.nome}: ricontrollo tra qualche giorno.`),
  /** Bagnata con il concime sciolto nell'acqua: segna l'annaffiatura e i concimi in sospeso. */
  "bagnata-concime": (el) => segna(
    el,
    (p) => registraConcime(p, concimeInAcqua(p), { conAcqua: true }),
    (p) => `${p.nome}: ${verbi(p).fatta} con il concime.`,
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
  ),
  /** Bagnata un altro giorno (scheda): legge la data dal campo accanto. */
  "bagnata-il": (el) => {
    const campo = document.getElementById("altro-giorno");
    const giorno = campo?.value;
    if (!giorno) return toast("Scegli il giorno.");
    if (giorno > giornoRoma()) return toast("Il giorno non può essere nel futuro.");
    segna(el, (p) => registraCura(p, "bagnata", mezzogiorno(giorno)), (p) => `${p.nome}: ${verbi(p).fatta} il ${giorno.split("-").reverse().join("/")}.`);
  },
};
