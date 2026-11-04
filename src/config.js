// Configurazione letta in build: in produzione dalle Variables del repo GitHub, in locale da .env.local.
// La chiave publishable è fatta per stare nel client: i dati li proteggono le policy RLS su Supabase.
// La chiave secret / service_role non deve mai arrivare qui (vite.config.js blocca la build se succede).
export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || "").trim().replace(/\/+$/, "");
export const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "").trim();
// Chiave pubblica VAPID: serve al browser per iscriversi alle notifiche. Non è segreta.
export const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY || "").trim();
export const VERSIONE = (import.meta.env.VITE_VERSIONE || "locale").slice(0, 7);
export const configurato = Boolean(SUPABASE_URL && SUPABASE_KEY);
