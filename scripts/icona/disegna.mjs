// Rifà le icone PNG dell'app dagli SVG di questa cartella (la goccia della mascotte, con i tratti più marcati).
// Serve Chromium via Playwright, che non è tra le dipendenze del progetto:
//   npx -y -p playwright node scripts/icona/disegna.mjs     (la prima volta: npx playwright install chromium)
// I nomi dei file cambiano quando cambia il disegno (goccia-…): così Safari non riusa la vecchia icona in cache.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const qui = (f) => fileURLToPath(new URL(f, import.meta.url));
const uscita = (f) => fileURLToPath(new URL(`../../public/icons/${f}`, import.meta.url));

const lavori = [
  ["icona-app.svg", 180, "goccia-180.png"],        // apple-touch-icon (iOS arrotonda da sé gli angoli)
  ["icona-app.svg", 192, "goccia-192.png"],        // manifest, notifiche, favicon di ripiego
  ["icona-app.svg", 512, "goccia-512.png"],        // manifest
  ["icona-maskable.svg", 512, "goccia-maskable-512.png"], // Android: goccia più piccola, resta dentro il cerchio
];

const browser = await chromium.launch();
for (const [svg, lato, png] of lavori) {
  const page = await browser.newPage({ viewport: { width: lato, height: lato }, deviceScaleFactor: 1 });
  const dati = readFileSync(qui(svg)).toString("base64");
  await page.setContent(`<body style="margin:0"><img src="data:image/svg+xml;base64,${dati}" width="${lato}" height="${lato}" style="display:block">`);
  await page.waitForTimeout(150);
  await page.screenshot({ path: uscita(png) });
  await page.close();
}
await browser.close();
console.log("Icone aggiornate in public/icons/.");
