import { sb } from "./supabase.js";
import { VAPID_PUBLIC_KEY } from "./config.js";
import { aggiorna } from "./stato.js";

// Notifiche push. Su iPhone funzionano solo dall'app aggiunta alla schermata Home.
//   - iOS 18.4 e successivi: Declarative Web Push con window.pushManager, senza service worker.
//   - altri browser (e iOS più vecchi): service worker minimo in public/sw.js, che mostra lo stesso messaggio.
// L'iscrizione (endpoint e chiavi del dispositivo) si salva in push_iscrizioni; la funzione promemoria la usa.

const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const ios = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const dichiarativo = () => "pushManager" in window;
const conServiceWorker = () => "serviceWorker" in navigator && "PushManager" in window;

/** Indirizzo dell'app (senza hash): la notifica porta qui. */
const urlApp = () => location.origin + location.pathname;

function supporto() {
  if (!VAPID_PUBLIC_KEY) return "da-configurare";
  if (ios() && !standalone()) return "serve-home";
  if (!("Notification" in window) || !(dichiarativo() || conServiceWorker())) return "non-supportate";
  return null;
}

async function gestore({ crea }) {
  if (dichiarativo()) return window.pushManager;
  let reg = await navigator.serviceWorker.getRegistration("./");
  if (!reg && crea) {
    reg = await navigator.serviceWorker.register("./sw.js", { scope: "./" });
    await navigator.serviceWorker.ready;
  }
  return reg?.pushManager || null;
}

const chiaveUguale = (iscrizione) => {
  const attuale = iscrizione.options?.applicationServerKey;
  if (!attuale) return true;
  const nostra = chiaveInByte(VAPID_PUBLIC_KEY);
  const a = new Uint8Array(attuale);
  return a.length === nostra.length && a.every((b, i) => b === nostra[i]);
};

function chiaveInByte(b64u) {
  const b64 = b64u.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(b64u.length / 4) * 4, "=");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** Controlla lo stato senza chiedere niente: all'avvio e quando riapri l'app. */
export async function verificaNotifiche() {
  const manca = supporto();
  if (manca) return aggiorna({ notifiche: manca });
  if (Notification.permission === "denied") return aggiorna({ notifiche: "bloccate" });
  try {
    const pm = await gestore({ crea: false });
    const iscrizione = await pm?.getSubscription();
    if (iscrizione && Notification.permission === "granted") {
      await salvaIscrizione(iscrizione); // tiene aggiornato il server se il browser ha rinnovato le chiavi
      return aggiorna({ notifiche: "attive" });
    }
  } catch (e) {
    console.error("notifiche", e);
  }
  aggiorna({ notifiche: "spente" });
}

/** Chiede il permesso e iscrive questo dispositivo. Va chiamata da un tocco (iOS lo richiede). */
export async function attivaNotifiche() {
  const manca = supporto();
  if (manca) throw new Error(spiegazione(manca));
  const permesso = await Notification.requestPermission();
  if (permesso !== "granted") {
    aggiorna({ notifiche: permesso === "denied" ? "bloccate" : "spente" });
    throw new Error(permesso === "denied" ? spiegazione("bloccate") : "Permesso non concesso.");
  }
  const pm = await gestore({ crea: true });
  let iscrizione = await pm.getSubscription();
  if (iscrizione && !chiaveUguale(iscrizione)) {
    await iscrizione.unsubscribe();
    iscrizione = null;
  }
  if (!iscrizione) {
    iscrizione = await pm.subscribe({ userVisibleOnly: true, applicationServerKey: chiaveInByte(VAPID_PUBLIC_KEY) });
  }
  await salvaIscrizione(iscrizione);
  aggiorna({ notifiche: "attive" });
}

export async function disattivaNotifiche() {
  const pm = await gestore({ crea: false });
  const iscrizione = await pm?.getSubscription();
  if (iscrizione) {
    await sb.from("push_iscrizioni").delete().eq("endpoint", iscrizione.endpoint);
    await iscrizione.unsubscribe();
  }
  aggiorna({ notifiche: "spente" });
}

/** Chiede alla funzione promemoria di mandare subito una notifica a tutti i miei dispositivi. */
export async function inviaProva() {
  const { data, error } = await sb.functions.invoke("promemoria", { body: { prova: true } });
  if (error) {
    let dettaglio = "";
    try { dettaglio = (await error.context?.json())?.errore || ""; } catch { /* corpo non JSON */ }
    throw new Error(dettaglio || "La funzione promemoria non risponde. È pubblicata?");
  }
  if (!data?.inviate) throw new Error(data?.errori?.[0] || "Nessuna notifica partita.");
  return data;
}

async function salvaIscrizione(iscrizione) {
  const j = iscrizione.toJSON();
  const { error } = await sb.from("push_iscrizioni").upsert(
    { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, app_url: urlApp(), dispositivo: dispositivo() },
    { onConflict: "endpoint" },
  );
  if (error) throw error;
}

function dispositivo() {
  const ua = navigator.userAgent;
  const nome = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : "Browser";
  return `${nome}${standalone() ? " · app" : ""}`;
}

export function spiegazione(stato) {
  return {
    "serve-home": "Su iPhone le notifiche arrivano solo dall'app sulla schermata Home: in Safari tocca Condividi › Aggiungi alla schermata Home, poi aprila da lì.",
    bloccate: "Le notifiche sono bloccate: riattivale da Impostazioni › Notifiche › Piante.",
    "non-supportate": "Questo browser non supporta le notifiche push.",
    "da-configurare": "Manca la chiave VAPID nella configurazione dell'app (Variable VAPID_PUBLIC_KEY).",
  }[stato] || "";
}

/** Il numerino sull'icona dell'app: quante piante sono da controllare. */
export function aggiornaBadge(n) {
  try {
    if (n > 0) navigator.setAppBadge?.(n)?.catch(() => {});
    else navigator.clearAppBadge?.()?.catch(() => {});
  } catch { /* badge non supportato */ }
}
