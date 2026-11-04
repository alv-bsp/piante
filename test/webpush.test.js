// Verifica la cifratura e la firma di webpush.js decifrando dal lato "browser", come farebbe Safari.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cifra, chiaviVapid, intestazioneVapid, daBase64url, inBase64url, endpointAmmesso } from "../supabase/functions/_shared/webpush.js";

const te = new TextEncoder();
const td = new TextDecoder();
const { subtle } = globalThis.crypto;

async function hkdf(sale, ikm, info, n) {
  const k = await subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: sale, info }, k, n * 8));
}

/** Browser finto: chiavi p256dh/auth e decifratura secondo RFC 8291. */
async function browser() {
  const chiavi = await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const pub = new Uint8Array(await subtle.exportKey("raw", chiavi.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return {
    p256dh: inBase64url(pub),
    auth: inBase64url(auth),
    async decifra(corpo) {
      const sale = corpo.slice(0, 16);
      const rs = new DataView(corpo.buffer, corpo.byteOffset + 16, 4).getUint32(0);
      const idlen = corpo[20];
      const pubServer = corpo.slice(21, 21 + idlen);
      const cifrato = corpo.slice(21 + idlen);
      assert.equal(rs, 4096);
      assert.equal(idlen, 65);
      const kServer = await subtle.importKey("raw", pubServer, { name: "ECDH", namedCurve: "P-256" }, false, []);
      const ecdh = new Uint8Array(await subtle.deriveBits({ name: "ECDH", public: kServer }, chiavi.privateKey, 256));
      const info = new Uint8Array([...te.encode("WebPush: info"), 0, ...pub, ...pubServer]);
      const ikm = await hkdf(auth, ecdh, info, 32);
      const cek = await hkdf(sale, ikm, new Uint8Array([...te.encode("Content-Encoding: aes128gcm"), 0]), 16);
      const nonce = await hkdf(sale, ikm, new Uint8Array([...te.encode("Content-Encoding: nonce"), 0]), 12);
      const k = await subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
      const chiaro = new Uint8Array(await subtle.decrypt({ name: "AES-GCM", iv: nonce }, k, cifrato));
      assert.equal(chiaro.at(-1), 2, "delimitatore dell'ultimo record");
      return td.decode(chiaro.slice(0, -1));
    },
  };
}

test("base64url andata e ritorno", () => {
  const b = crypto.getRandomValues(new Uint8Array(65));
  assert.deepEqual(daBase64url(inBase64url(b)), b);
});

test("il browser decifra il messaggio, anche con accenti", async () => {
  const b = await browser();
  const messaggio = JSON.stringify({ web_push: 8030, notification: { title: "3 piante da controllare", body: "Città, perché, 🌿" } });
  const corpo = await cifra(messaggio, b.p256dh, b.auth);
  assert.equal(await b.decifra(corpo), messaggio);
});

test("ogni invio usa sale e chiavi nuove", async () => {
  const b = await browser();
  const [x, y] = await Promise.all([cifra("ciao", b.p256dh, b.auth), cifra("ciao", b.p256dh, b.auth)]);
  assert.notDeepEqual(x.slice(0, 16), y.slice(0, 16));
  assert.notDeepEqual(x.slice(21, 86), y.slice(21, 86));
});

test("intestazione VAPID: JWT ES256 verificabile con la chiave pubblica", async () => {
  const coppia = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const pub = inBase64url(new Uint8Array(await subtle.exportKey("raw", coppia.publicKey)));
  const priv = (await subtle.exportKey("jwk", coppia.privateKey)).d;
  const vapid = await chiaviVapid(pub, priv, "https://alv-bsp.github.io/piante/");

  const adesso = Date.UTC(2026, 10, 4, 8, 0, 0);
  const h = await intestazioneVapid("https://web.push.apple.com/QGuQyavXutnMH...", vapid, adesso);
  const [, jwt, k] = h.match(/^vapid t=([^,]+), k=(.+)$/);
  assert.equal(k, pub);

  const [testa, corpo, firma] = jwt.split(".");
  assert.deepEqual(JSON.parse(td.decode(daBase64url(testa))), { typ: "JWT", alg: "ES256" });
  const claims = JSON.parse(td.decode(daBase64url(corpo)));
  assert.equal(claims.aud, "https://web.push.apple.com");
  assert.equal(claims.sub, "https://alv-bsp.github.io/piante/");
  assert.equal(claims.exp, adesso / 1000 + 12 * 3600);

  const verifica = await subtle.importKey("raw", daBase64url(pub), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  const ok = await subtle.verify({ name: "ECDSA", hash: "SHA-256" }, verifica, daBase64url(firma), te.encode(`${testa}.${corpo}`));
  assert.ok(ok, "firma valida");
});

test("chiavi VAPID sbagliate vengono rifiutate", async () => {
  await assert.rejects(chiaviVapid("abc", "def", "mailto:x@y.z"), /VAPID_PUBLIC_KEY/);
});

test("si manda solo ai servizi push dei browser", () => {
  assert.ok(endpointAmmesso("https://web.push.apple.com/abc"));
  assert.ok(endpointAmmesso("https://fcm.googleapis.com/fcm/send/abc"));
  assert.ok(endpointAmmesso("https://updates.push.services.mozilla.com/wpush/v2/abc"));
  assert.ok(!endpointAmmesso("https://esempio.it/abc"));
  assert.ok(!endpointAmmesso("http://web.push.apple.com/abc"));
  assert.ok(!endpointAmmesso("https://push.apple.com.esempio.it/abc"));
});
