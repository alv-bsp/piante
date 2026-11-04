import { sb } from "./supabase.js";

/** Login con email e password. Lancia un errore con un messaggio già pronto da mostrare. */
export async function accedi(email, password) {
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    console.error("accesso", error);
    throw new Error(messaggio(error));
  }
}

export async function esci() {
  await sb.auth.signOut();
}

function messaggio(e) {
  const testo = e.message || "";
  if (!navigator.onLine || e.name === "AuthRetryableFetchError" || /fetch|network/i.test(testo)) {
    return "Nessuna connessione. Riprova quando sei online.";
  }
  if (/invalid login credentials/i.test(testo) || e.code === "invalid_credentials") return "Email o password non corretti.";
  if (/email not confirmed/i.test(testo)) return "L'email non è confermata: confermala dal pannello di Supabase.";
  if (e.status === 429) return "Troppi tentativi. Riprova tra qualche minuto.";
  return "Accesso non riuscito. Riprova.";
}
