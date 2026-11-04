// Genera le chiavi VAPID per le notifiche e un segreto per il cron. Si lancia una volta: `npm run chiavi`.
// Non salva niente su disco: copia i valori dove dice il README e chiudi il terminale.
import { webcrypto as crypto } from "node:crypto";

const b64u = (byte) => Buffer.from(byte).toString("base64url");

const coppia = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const jwk = await crypto.subtle.exportKey("jwk", coppia.privateKey);
const pubblica = b64u(new Uint8Array(await crypto.subtle.exportKey("raw", coppia.publicKey)));
const segreto = b64u(crypto.getRandomValues(new Uint8Array(32)));

console.log(`
Chiave pubblica (va nell'app e nella funzione, non è segreta)
  VAPID_PUBLIC_KEY=${pubblica}

Chiave privata (solo nei secret della funzione, mai nel repo né su GitHub)
  VAPID_PRIVATE_KEY=${jwk.d}

Segreto del cron (nei secret della funzione e in supabase/cron.sql)
  CRON_SECRET=${segreto}
`);
