// Azioni Bagnata / Ancora umida, uguali in Oggi, Casa e nella scheda. Un tocco segna, il toast permette di annullare.
import { trovaPianta } from "../stato.js";
import { registraCura, annullaCura, mezzogiorno } from "../dati.js";
import { toast } from "../ui/avvisi.js";
import { giornoRoma } from "../../supabase/functions/_shared/scadenze.js";
import { verbi } from "./comuni.js";

const inCorso = new Set();

async function segna(el, tipo, il) {
  const p = trovaPianta(el.dataset.id);
  if (!p || inCorso.has(p.id)) return;
  inCorso.add(p.id);
  el.setAttribute("aria-busy", "true");
  try {
    const cura = await registraCura(p, tipo, il);
    const v = verbi(p);
    const testo = tipo === "bagnata" ? `${p.nome}: ${v.fatta}.` : `${p.nome}: ricontrollo tra qualche giorno.`;
    toast(testo, {
      azione: async () => {
        try {
          await annullaCura(cura);
          toast("Annullato.");
        } catch (e) {
          console.error("annulla", e);
          toast("Non sono riuscito ad annullare. Riprova dalla scheda della pianta.");
        }
      },
    });
  } catch (e) {
    console.error("cura", e);
    toast(navigator.onLine ? "Non sono riuscito a salvarlo. Riprova." : "Sei offline: riprova quando c'è rete.");
  } finally {
    inCorso.delete(p.id);
    el.removeAttribute?.("aria-busy");
  }
}

export const azioni = {
  bagnata: (el) => segna(el, "bagnata"),
  umida: (el) => segna(el, "controllata"),
  /** Bagnata un altro giorno (scheda): legge la data dal campo accanto. */
  "bagnata-il": (el) => {
    const campo = document.getElementById("altro-giorno");
    const giorno = campo?.value;
    if (!giorno) return toast("Scegli il giorno.");
    if (giorno > giornoRoma()) return toast("Il giorno non può essere nel futuro.");
    segna(el, "bagnata", mezzogiorno(giorno));
  },
};
