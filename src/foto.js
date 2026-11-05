import { sb } from "./supabase.js";

// Foto del diario di crescita (stesso codice dell'Armadio): ridimensionate e compresse nel browser, poi caricate nel
// bucket privato "piante". Percorsi: <user_id>/<pianta_id>/<versione>.<webp|jpg> e <versione>-mini.<webp|jpg>.
// La foto "di copertina" di una pianta invece è quella generica della specie (specie.js).

const BUCKET = "piante";
const GRANDE = { lato: 1200, max: 250_000, qualita: 0.86 };   // lato lungo
const MINI = { corto: 240, max: 30_000, qualita: 0.78 };       // lato corto, basta per le miniature degli elenchi

let formato = null; // "image/webp" se il browser lo sa produrre, altrimenti "image/jpeg" (Safari)

async function formatoMigliore() {
  if (formato) return formato;
  const c = document.createElement("canvas");
  c.width = c.height = 2;
  const blob = await new Promise((ok) => c.toBlob(ok, "image/webp", 0.8));
  formato = blob?.type === "image/webp" ? "image/webp" : "image/jpeg";
  return formato;
}

async function apri(file) {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* alcuni formati passano solo da <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function disegna(sorgente, larghezza, altezza) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(larghezza));
  c.height = Math.max(1, Math.round(altezza));
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(sorgente, 0, 0, c.width, c.height);
  return c;
}

const versoBlob = (canvas, tipo, q) => new Promise((ok, ko) =>
  canvas.toBlob((b) => (b ? ok(b) : ko(new Error("Compressione non riuscita"))), tipo, q));

/** Comprime abbassando la qualità finché il file sta sotto il tetto. */
async function comprimi(canvas, tipo, { max, qualita }) {
  let q = qualita;
  let blob = await versoBlob(canvas, tipo, q);
  while (blob.size > max && q > 0.42) {
    q = Math.max(0.42, q - (blob.size > max * 1.6 ? 0.14 : 0.07));
    blob = await versoBlob(canvas, tipo, q);
  }
  return blob;
}

/**
 * Se anche alla qualità minima il file supera il tetto (foto piene di dettaglio o rumore),
 * rimpicciolisce del 15% e riprova, fino a tre volte.
 */
async function entroIlTetto(sorgente, larghezza, altezza, tipo, opzioni) {
  let scala = 1;
  for (let tentativo = 0; ; tentativo++) {
    const canvas = disegna(sorgente, larghezza * scala, altezza * scala);
    const blob = await comprimi(canvas, tipo, opzioni);
    if (blob.size <= opzioni.max || tentativo === 3) return { blob, canvas };
    scala *= 0.85;
  }
}

/**
 * Prepara foto e miniatura da un file della fotocamera o della galleria.
 * Restituisce i due blob, l'estensione e un'anteprima locale da mostrare subito.
 */
export async function preparaFoto(file) {
  const tipo = await formatoMigliore();
  const img = await apri(file);
  const w = img.width, h = img.height;
  if (!w || !h) throw new Error("Immagine non leggibile");

  const k = Math.min(1, GRANDE.lato / Math.max(w, h));
  const g = await entroIlTetto(img, w * k, h * k, tipo, GRANDE);
  img.close?.();
  const km = Math.min(1, MINI.corto / Math.min(g.canvas.width, g.canvas.height));
  const m = await entroIlTetto(g.canvas, g.canvas.width * km, g.canvas.height * km, tipo, MINI);
  const grande = g.blob, mini = m.blob;
  return {
    grande,
    mini,
    tipo,
    estensione: tipo === "image/webp" ? "webp" : "jpg",
    anteprima: URL.createObjectURL(grande),
    anteprimaMini: URL.createObjectURL(mini),
  };
}

/** Carica foto e miniatura della pianta; restituisce i due percorsi. */
export async function caricaFoto(userId, piantaId, foto) {
  const versione = Date.now().toString(36);
  const base = `${userId}/${piantaId}/${versione}`;
  const percorsi = { foto: `${base}.${foto.estensione}`, miniatura: `${base}-mini.${foto.estensione}` };
  const opzioni = { contentType: foto.tipo, cacheControl: "31536000", upsert: false };
  const [a, b] = await Promise.all([
    sb.storage.from(BUCKET).upload(percorsi.foto, foto.grande, opzioni),
    sb.storage.from(BUCKET).upload(percorsi.miniatura, foto.mini, opzioni),
  ]);
  if (a.error || b.error) {
    await rimuoviFoto([percorsi.foto, percorsi.miniatura]);
    throw a.error || b.error;
  }
  // L'anteprima locale vale subito come immagine della pianta, senza aspettare la signed URL.
  cache.set(percorsi.foto, { url: foto.anteprima, scade: Infinity });
  cache.set(percorsi.miniatura, { url: foto.anteprimaMini, scade: Infinity });
  return percorsi;
}

export async function rimuoviFoto(percorsi) {
  const validi = percorsi.filter(Boolean);
  if (!validi.length) return;
  const { error } = await sb.storage.from(BUCKET).remove(validi);
  if (error) console.error("rimozione foto", error);
  validi.forEach((p) => cache.delete(p));
}

// ───────────────────────────── signed URL, chieste in blocco e tenute in memoria
const DURATA = 3600; // secondi
const cache = new Map(); // percorso → { url, scade }
let inCorso = null;

export async function urlFirmati(percorsi) {
  const ora = Date.now();
  const mancanti = [...new Set(percorsi.filter((p) => p && !(cache.get(p)?.scade > ora + 120_000)))];
  if (mancanti.length) {
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(mancanti, DURATA);
    if (error) console.error("signed URL", error);
    for (const d of data || []) {
      if (d.signedUrl && !d.error) cache.set(d.path, { url: d.signedUrl, scade: ora + DURATA * 1000 });
    }
  }
  return (p) => cache.get(p)?.url || null;
}

/** Dà un indirizzo a tutte le <img data-foto="percorso"> ancora vuote dentro radice, con una sola richiesta. */
export async function idrataFoto(radice = document) {
  const immagini = [...radice.querySelectorAll("img[data-foto]:not([src])")];
  if (!immagini.length) return;
  const giri = inCorso || Promise.resolve();
  inCorso = giri.then(async () => {
    const url = await urlFirmati(immagini.map((i) => i.dataset.foto));
    for (const img of immagini) {
      const u = url(img.dataset.foto);
      if (u) img.src = u;
      else img.closest(".foto")?.classList.add("senza");
    }
  });
  await inCorso;
}

/** Indirizzo già pronto in memoria, se c'è (evita lo sfarfallio quando si ridisegna). */
export const urlInCache = (p) => (p && cache.get(p)?.scade > Date.now() + 60_000 ? cache.get(p).url : null);
