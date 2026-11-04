// Edge Function "promemoria": manda le notifiche delle piante da controllare.
//
// Due modi di chiamarla:
//   1. dal cron ogni ora (supabase/cron.sql), con l'intestazione x-cron-secret: per ogni utente, se a Roma è
//      passata la sua ora del promemoria e oggi non ha ancora ricevuto niente, manda una notifica con le piante
//      da controllare e i concimi da dare;
//   2. dall'app (Account › Invia una prova), con il token di login: manda subito la notifica a chi la chiede.
//
// Si pubblica senza verifica JWT del gateway (--no-verify-jwt): l'autorizzazione la fa questo file.
// Secret richiesti: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import { giornoRoma, oraRoma, daFareOggi, quantePiante, testoPromemoria, messaggioPush } from "../_shared/scadenze.js";
import { chiaviVapid, inviaPush } from "../_shared/webpush.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const risposta = (corpo: unknown, stato = 200) =>
  new Response(JSON.stringify(corpo), { status: stato, headers: { ...CORS, "Content-Type": "application/json" } });

/** Chiave secret del progetto: quella nuova (SUPABASE_SECRET_KEYS) se c'è, altrimenti la service_role legacy. */
function chiaveServizio(): string {
  const nuove = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (nuove) {
    try {
      const chiave = JSON.parse(nuove).default;
      if (chiave) return chiave;
    } catch { /* formato inatteso: si prova la legacy */ }
  }
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!legacy) throw new Error("Nessuna chiave secret disponibile nella funzione.");
  return legacy;
}

/** Confronto a tempo costante, per non dare indizi sul segreto. */
function uguali(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

type Iscrizione = { endpoint: string; p256dh: string; auth: string; app_url: string; user_id: string };
type Esito = { inviate: number; fallite: number; scadute: number; piante: number; errori: string[] };
type DaFare = { acqua: unknown[]; concime: unknown[] };

/** Piante da controllare e concimi da dare oggi per un utente (stesse regole dell'app). */
async function daFareDi(db: SupabaseClient, userId: string, oggi: string): Promise<DaFare> {
  const { data: piante, error: e1 } = await db
    .from("piante")
    .select("id, nome, stanza, vaso, substrato, giorni_estate, giorni_inverno, irrigazione_automatica, creata_il, archiviata_il")
    .eq("user_id", userId)
    .is("archiviata_il", null);
  if (e1) throw e1;
  if (!piante.length) return { acqua: [], concime: [] };
  const ids = piante.map((p) => p.id);
  const [ultime, cicli] = await Promise.all([
    db.from("ultime_cure").select("pianta_id, ultima_bagnata, ultimo_controllo").in("pianta_id", ids),
    db.from("cicli_concime").select("id, pianta_id, prodotto, ogni_giorni, dal_mese, al_mese, con_acqua, creato_il").in("pianta_id", ids),
  ]);
  if (ultime.error) throw ultime.error;
  if (cicli.error) throw cicli.error;
  const concimazioni = cicli.data.length
    ? await db.from("ultime_concimazioni").select("ciclo_id, ultima").in("ciclo_id", cicli.data.map((c) => c.id))
    : { data: [], error: null };
  if (concimazioni.error) throw concimazioni.error;

  const perPianta = new Map<string, typeof cicli.data>();
  for (const c of cicli.data) perPianta.set(c.pianta_id, [...(perPianta.get(c.pianta_id) ?? []), c]);
  return daFareOggi(
    piante,
    new Map(ultime.data.map((u) => [u.pianta_id, u])),
    perPianta,
    new Map(concimazioni.data.map((u) => [u.ciclo_id, u.ultima])),
    oggi,
  );
}

const niente = (d: DaFare) => !d.acqua.length && !d.concime.length;

/** Manda la stessa notifica a tutti i dispositivi di un utente; cancella le iscrizioni revocate dal browser. */
async function mandaATutti(db: SupabaseClient, iscrizioni: Iscrizione[], daFare: DaFare, vapid: unknown, prova = false): Promise<Esito> {
  const quante = quantePiante(daFare);
  const esito: Esito = { inviate: 0, fallite: 0, scadute: 0, piante: quante, errori: [] };
  const testo = testoPromemoria(daFare);
  if (prova) testo.titolo = niente(daFare) ? "Notifiche attive" : `Prova · ${testo.titolo}`;
  for (const s of iscrizioni) {
    const url = new URL("#/oggi", s.app_url).href;
    try {
      const r = await inviaPush(s, messaggioPush(testo, url, quante), vapid);
      if (r.ok) {
        esito.inviate++;
        await db.from("push_iscrizioni").update({ usata_il: new Date().toISOString() }).eq("endpoint", s.endpoint);
      } else if (r.scaduta) {
        esito.scadute++;
        await db.from("push_iscrizioni").delete().eq("endpoint", s.endpoint);
      } else {
        esito.fallite++;
        esito.errori.push(`${r.stato} ${r.errore}`.trim());
      }
    } catch (e) {
      esito.fallite++;
      esito.errori.push(String((e as Error)?.message || e));
    }
  }
  return esito;
}

/** Giro orario del cron. Recupera da solo un giro saltato: conta "dall'ora scelta in poi", una volta al giorno. */
async function giroOrario(db: SupabaseClient, vapid: unknown) {
  const adesso = new Date();
  const oggi = giornoRoma(adesso);
  const ora = oraRoma(adesso);

  const { data: iscrizioni, error } = await db.from("push_iscrizioni").select("endpoint, p256dh, auth, app_url, user_id");
  if (error) throw error;
  const perUtente = new Map<string, Iscrizione[]>();
  for (const s of iscrizioni as Iscrizione[]) perUtente.set(s.user_id, [...(perUtente.get(s.user_id) ?? []), s]);
  if (!perUtente.size) return { oggi, ora, utenti: {} };

  const { data: impostazioni, error: e2 } = await db
    .from("promemoria")
    .select("user_id, ora, ultimo_invio")
    .in("user_id", [...perUtente.keys()]);
  if (e2) throw e2;
  const imp = new Map(impostazioni.map((r) => [r.user_id, r]));

  const utenti: Record<string, unknown> = {};
  for (const [userId, sue] of perUtente) {
    const mie = imp.get(userId);
    const oraScelta = mie?.ora ?? 9;
    if (ora < oraScelta || mie?.ultimo_invio === oggi) {
      utenti[userId] = "non ancora / già fatto";
      continue;
    }
    const daFare = await daFareDi(db, userId, oggi);
    const esito = niente(daFare) ? null : await mandaATutti(db, sue, daFare, vapid);
    // Se tutti gli invii falliscono si riprova al giro dopo; se non c'era niente da dire, il giorno è fatto.
    if (!esito || esito.inviate > 0) {
      await db.from("promemoria").upsert({ user_id: userId, ultimo_invio: oggi }, { onConflict: "user_id" });
    }
    utenti[userId] = esito ?? "niente da fare";
  }
  return { oggi, ora, utenti };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return risposta({ errore: "Usa POST." }, 405);

  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, chiaveServizio(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const vapid = await chiaviVapid(
      Deno.env.get("VAPID_PUBLIC_KEY") ?? "",
      Deno.env.get("VAPID_PRIVATE_KEY") ?? "",
      Deno.env.get("VAPID_SUBJECT") ?? "",
    );

    // 1. Cron
    const segreto = Deno.env.get("CRON_SECRET") ?? "";
    const dalCron = req.headers.get("x-cron-secret");
    if (dalCron !== null) {
      if (!segreto || !uguali(dalCron, segreto)) return risposta({ errore: "Segreto del cron non valido." }, 401);
      return risposta(await giroOrario(db, vapid));
    }

    // 2. Prova dall'app, con il token di login
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data, error } = token ? await db.auth.getUser(token) : { data: { user: null }, error: null };
    if (error || !data.user) return risposta({ errore: "Serve il login." }, 401);

    const { data: sue, error: e } = await db
      .from("push_iscrizioni")
      .select("endpoint, p256dh, auth, app_url, user_id")
      .eq("user_id", data.user.id);
    if (e) throw e;
    if (!sue.length) return risposta({ errore: "Nessun dispositivo iscritto alle notifiche." }, 404);
    const daFare = await daFareDi(db, data.user.id, giornoRoma());
    return risposta(await mandaATutti(db, sue as Iscrizione[], daFare, vapid, true));
  } catch (e) {
    console.error("promemoria", e);
    return risposta({ errore: String((e as Error)?.message || e) }, 500);
  }
});
