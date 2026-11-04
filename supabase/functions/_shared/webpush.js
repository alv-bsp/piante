// Web Push senza librerie, solo WebCrypto e fetch: gira in Deno (Edge Functions) e in Node (test/webpush.test.js).
//   - cifratura del messaggio: RFC 8291 (aes128gcm, RFC 8188)
//   - firma del mittente: RFC 8292 (VAPID, JWT ES256)
// Le chiavi VAPID si generano con `npm run chiavi`: la pubblica va nell'app, la privata solo nei secret.

const te = new TextEncoder();

export function daBase64url(testo) {
  const b64 = testo.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(testo.length / 4) * 4, "=");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export function inBase64url(byte) {
  let s = "";
  for (const b of byte) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const unisci = (...parti) => {
  const out = new Uint8Array(parti.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parti) {
    out.set(p, i);
    i += p.length;
  }
  return out;
};

async function hkdf(sale, materiale, info, lunghezza) {
  const chiave = await crypto.subtle.importKey("raw", materiale, "HKDF", false, ["deriveBits"]);
  const bit = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: sale, info }, chiave, lunghezza * 8);
  return new Uint8Array(bit);
}

/** Prepara le chiavi VAPID: pubblica (65 byte, base64url) e privata (32 byte, base64url). */
export async function chiaviVapid(pubblica, privata, soggetto) {
  const pub = daBase64url(pubblica);
  if (pub.length !== 65 || pub[0] !== 4) throw new Error("VAPID_PUBLIC_KEY non valida: servono 65 byte in base64url.");
  if (daBase64url(privata).length !== 32) throw new Error("VAPID_PRIVATE_KEY non valida: servono 32 byte in base64url.");
  if (!/^(mailto:|https:\/\/)/.test(soggetto || "")) throw new Error("VAPID_SUBJECT deve iniziare con mailto: o https://");
  const jwk = {
    kty: "EC",
    crv: "P-256",
    x: inBase64url(pub.slice(1, 33)),
    y: inBase64url(pub.slice(33, 65)),
    d: privata,
  };
  const firma = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  return { pubblica, firma, soggetto };
}

/** Intestazione Authorization VAPID per un endpoint: JWT ES256 valido 12 ore per l'origine del servizio push. */
export async function intestazioneVapid(endpoint, vapid, adesso = Date.now()) {
  const json = (o) => inBase64url(te.encode(JSON.stringify(o)));
  const testa = json({ typ: "JWT", alg: "ES256" });
  const corpo = json({ aud: new URL(endpoint).origin, exp: Math.floor(adesso / 1000) + 12 * 3600, sub: vapid.soggetto });
  const firma = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, vapid.firma, te.encode(`${testa}.${corpo}`));
  return `vapid t=${testa}.${corpo}.${inBase64url(new Uint8Array(firma))}, k=${vapid.pubblica}`;
}

/**
 * Cifra il testo per un'iscrizione (chiavi p256dh e auth del browser) in un solo record aes128gcm.
 * `prova` serve solo ai test, per fissare sale e chiavi effimere.
 */
export async function cifra(testo, p256dh, auth, prova = {}) {
  const pubBrowser = daBase64url(p256dh);
  const segretoAuth = daBase64url(auth);
  const effimere = prova.effimere || (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]));
  const pubMia = new Uint8Array(await crypto.subtle.exportKey("raw", effimere.publicKey));
  const chiaveBrowser = await crypto.subtle.importKey("raw", pubBrowser, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const condiviso = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: chiaveBrowser }, effimere.privateKey, 256));

  const ikm = await hkdf(segretoAuth, condiviso, unisci(te.encode("WebPush: info\0"), pubBrowser, pubMia), 32);
  const sale = prova.sale || crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(sale, ikm, te.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(sale, ikm, te.encode("Content-Encoding: nonce\0"), 12);

  const chiaveAes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const chiaro = unisci(te.encode(testo), new Uint8Array([2])); // 0x02: ultimo (e unico) record, senza riempimento
  const cifrato = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, chiaveAes, chiaro));

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return unisci(sale, rs, new Uint8Array([pubMia.length]), pubMia, cifrato);
}

/** Servizi push dei browser: la funzione manda richieste solo a questi indirizzi. */
const SERVIZI = [/\.push\.apple\.com$/, /^fcm\.googleapis\.com$/, /\.mozilla\.com$/, /\.notify\.windows\.com$/];
export const endpointAmmesso = (endpoint) => {
  try {
    const u = new URL(endpoint);
    return u.protocol === "https:" && SERVIZI.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
};

/**
 * Manda un messaggio (oggetto JSON) a un'iscrizione { endpoint, p256dh, auth }.
 * Restituisce { ok, stato, scaduta }: scaduta vuol dire che il browser l'ha revocata e va cancellata.
 */
export async function inviaPush(iscrizione, messaggio, vapid, { ttl = 12 * 3600, urgenza = "normal" } = {}) {
  if (!endpointAmmesso(iscrizione.endpoint)) return { ok: false, stato: 0, scaduta: false, errore: "endpoint non ammesso" };
  const corpo = await cifra(JSON.stringify(messaggio), iscrizione.p256dh, iscrizione.auth);
  const r = await fetch(iscrizione.endpoint, {
    method: "POST",
    headers: {
      Authorization: await intestazioneVapid(iscrizione.endpoint, vapid),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(ttl),
      Urgency: urgenza,
    },
    body: corpo,
  });
  const errore = r.ok ? "" : (await r.text().catch(() => "")).slice(0, 300);
  return { ok: r.ok, stato: r.status, scaduta: r.status === 404 || r.status === 410, errore };
}
