import { defineConfig, loadEnv } from "vite";

// Base relativa: l'app funziona sotto https://<utente>.github.io/<repo>/ qualunque sia il nome del repo.
// Il routing è a hash, quindi non serve il 404.html di ripiego.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  controllaChiave(env.VITE_SUPABASE_PUBLISHABLE_KEY);
  return {
    base: "./",
    build: { target: "es2022", sourcemap: false },
  };
});

/**
 * Rete di sicurezza: la build si ferma se nel bundle sta per finire una chiave segreta.
 * Nel frontend va solo la chiave publishable (sb_publishable_…) o la vecchia anon.
 */
function controllaChiave(chiave = "") {
  const errore = "VITE_SUPABASE_PUBLISHABLE_KEY contiene una chiave segreta: usa la publishable, mai la secret/service_role.";
  if (chiave.startsWith("sb_secret_")) throw new Error(errore);
  const parti = chiave.split(".");
  if (parti.length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(parti[1], "base64url").toString("utf8"));
      if (payload.role && payload.role !== "anon") throw new Error(errore);
    } catch (e) {
      if (e.message === errore) throw e;
    }
  }
}
