# Piante

Webapp personale per le piante di casa: dove sono, quando le ho bagnate, quando controllarle.
Un solo utente, pensata per il telefono e installabile sulla schermata Home. Sorella dell'Armadio: stesso stack,
stesso stile, accento verde.

- **Frontend**: Vite + JavaScript senza framework, pubblicato su GitHub Pages da GitHub Actions a ogni push su `main`.
- **Backend**: lo stesso progetto Supabase dell'Armadio (piano gratuito). Tabelle con nomi diversi, stesso login.
- **Promemoria**: notifiche push. Ogni ora `pg_cron` chiama la Edge Function `promemoria`; all'ora che scegli
  nell'app (di base le 9) ti arriva una notifica sola con le piante da controllare, solo se ce ne sono.

## Come funziona

- **Oggi**: le piante da controllare, dalla più in ritardo, con due pulsanti: **Bagnata** e **Ancora umida**
  (per l'idroponica: **Rabboccata** e **Livello ok**). Sotto, quelle dei prossimi tre giorni.
- **Casa**: tutte le piante divise per stanza, con la miniatura, l'ultima annaffiatura e una goccia per segnarla al volo.
- **Scheda**: foto, stato, "bagnata un altro giorno", dati della pianta, storico (una voce sbagliata si cancella).
- **Foto**: una per pianta, per riconoscerla al volo. Dalla scheda, il tocco su "Aggiungi una foto" (o sulla
  fotocamera, per cambiarla) apre fotocamera o libreria e la salva subito; si può anche scegliere nel modulo.
- Ogni azione si può annullare dal messaggio che compare in basso.

Regole (in `supabase/functions/_shared/scadenze.js`, le stesse per app e notifiche):

- Una pianta va controllata quando sono passati N giorni dall'ultima annaffiatura: N estivo da aprile a settembre,
  invernale da ottobre a marzo. Si ragiona in giorni di calendario a Roma.
- **Ancora umida** sposta il controllo di un terzo di N (almeno 2 giorni).
- Una pianta mai segnata conta dal giorno in cui l'hai aggiunta.
- **Togli dalla casa** la archivia: sparisce dagli elenchi e dai promemoria, lo storico resta.
  Da Account › Piante tolte si rimette o si elimina per sempre.

## Passi manuali, una volta sola

0. **Repo GitHub**: `alv-bsp/piante`, pubblico, vuoto (senza README né .gitignore).
   Dalla cartella del progetto: `git push -u origin main` (il remote `origin` è già impostato).
1. **Supabase** (progetto dell'Armadio) → **SQL Editor** → incolla ed esegui `supabase/schema.sql`.
2. **Chiavi**: `npm install`, poi `npm run chiavi`. Stampa `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `CRON_SECRET`.
   Non le salva da nessuna parte: tienile aperte fino al passo 5.
3. **Funzione promemoria**, dalla cartella del progetto (`<ref>` è la parte prima di `.supabase.co` nel Project URL):
   ```bash
   npx supabase login
   npx supabase functions deploy promemoria --project-ref <ref> --no-verify-jwt
   npx supabase secrets set --project-ref <ref> \
     VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… CRON_SECRET=… \
     VAPID_SUBJECT=https://alv-bsp.github.io/piante/
   ```
4. **Cron**: apri `supabase/cron.sql`, sostituisci `<project-ref>` e `<CRON_SECRET>`, eseguilo nel SQL Editor.
   Non salvare il file con il segreto dentro: va eseguito, non committato.
5. **GitHub → repo → Settings → Secrets and variables → Actions → Variables** (tab Variables, non Secrets):
   - `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`: gli stessi valori dell'Armadio
   - `VAPID_PUBLIC_KEY`: la chiave pubblica del passo 2
6. **GitHub → Settings → Pages** → Source: **GitHub Actions**. Poi `git push` (o rilancia "Deploy su Pages").
   Quando è verde l'app è su `https://alv-bsp.github.io/piante/`.
7. **Sull'iPhone**: apri l'indirizzo in Safari → Condividi → **Aggiungi alla schermata Home**, apri l'app da lì e accedi
   con l'account dell'Armadio. Poi:
   - **Carica le mie piante** (le 13 di partenza, da `src/partenza.js`) e sistema le stanze da Casa;
   - **Account → Attiva le notifiche** → **Invia una prova**.

Le notifiche su iPhone arrivano solo all'app aperta dalla schermata Home, mai a Safari. Da iOS 18.4 usano il
Declarative Web Push e non serve service worker; sui browser più vecchi o diversi c'è `public/sw.js`, che fa solo
notifiche (niente cache).

## Sviluppo in locale

```bash
cd ~/Developer/personal/piante
npm install
cp .env.example .env.local   # URL, publishable key e VAPID_PUBLIC_KEY
npm run dev                  # http://localhost:5173
npm test                     # regole delle scadenze, cifratura e firma delle notifiche
```

## Sicurezza

- Login solo con email e password, registrazioni chiuse (impostazioni del progetto dell'Armadio).
- RLS attiva su tutte le tabelle: ogni riga è visibile e modificabile solo dal proprietario. Una cura è valida solo se
  la pianta è tua. Chi non ha fatto login non vede niente.
- Bucket `piante` privato (separato da `foto` dell'Armadio), massimo 1 MB a file, solo WebP e JPEG, ogni file nella
  cartella del proprio `user_id`. Le immagini si leggono solo con signed URL.
- La funzione `promemoria` è pubblicata senza verifica JWT del gateway e si autorizza da sola: il cron con
  `x-cron-secret` (confronto a tempo costante), l'app con il token di login. Usa la chiave secret del progetto, che
  Supabase le inietta da sé e non esce mai dalla funzione. Manda richieste solo ai servizi push di Apple, Google,
  Mozilla e Microsoft.
- La chiave privata VAPID e il `CRON_SECRET` stanno solo nei secret della funzione (e il secret anche nel Vault, per il
  cron). La chiave pubblica VAPID non è segreta.
- `vite.config.js` ferma la build se al posto della publishable arriva una chiave secret o service_role.

## Limiti e manutenzione

- **Pausa dopo 7 giorni di inattività** del progetto Supabase: lo tiene sveglio il keep-alive dell'Armadio, e qui c'è
  lo stesso workflow (`keepalive.yml`) come riserva. GitHub li disattiva dopo 60 giorni senza commit nel repo.
- **Storage 1 GB**, condiviso con le foto dell'Armadio. Le foto delle piante vengono ridimensionate e compresse nel
  browser (circa 1200 px sul lato lungo, 250 KB, più una miniatura da 30 KB): qualche migliaio di foto prima di
  riempirlo.
- **Notifica che non arriva**: SQL Editor →
  `select status_code, content from net._http_response order by created desc limit 5;` mostra le risposte della
  funzione. In Account, **Invia una prova** dice subito se il problema è la funzione o il dispositivo.
- **Cambio chiavi VAPID**: dopo `secrets set` e la nuova Variable, riapri l'app e tocca Attiva: l'iscrizione si rifà.

## Come è fatta

```
index.html                         shell della pagina
public/sw.js                       service worker solo per le notifiche (dove manca il Declarative Web Push)
src/main.js                        avvio, sessione, router, azioni
src/stato.js                       stato in memoria
src/dati.js                        letture e scritture su Supabase
src/notifiche.js                   permesso, iscrizione push, prova, badge
src/foto.js                        foto ridimensionate nel browser, caricamento, signed URL (come nell'Armadio)
src/partenza.js                    le piante di partenza
src/tempo.js                       date in parole
src/viste/                         Oggi, Casa, scheda, editor, account, accesso
supabase/schema.sql                tabelle, vista ultime_cure, grant, RLS, bucket delle foto
supabase/cron.sql                  pg_cron + pg_net + Vault
supabase/functions/promemoria/     Edge Function delle notifiche
supabase/functions/_shared/        regole delle scadenze e Web Push (WebCrypto, senza librerie)
scripts/chiavi.mjs                 chiavi VAPID e segreto del cron
test/                              node --test
```

## Decisioni

- **Stesso progetto Supabase dell'Armadio**: un login, un keep-alive, e il piano gratuito ha comunque solo due
  progetti attivi. Lo schema crea `ping()` solo se manca, quindi funziona anche in un progetto nuovo.
- **Notifiche push invece di Google Calendar**: dalla notifica alla pianta segnata è un tocco. Un calendario .ics
  sarebbe aggiornato da Google con ore di ritardo; le API di Google chiederebbero OAuth e token da custodire.
- **Controllare, non bagnare**: l'app non sa quanto è umido il terriccio. Il promemoria dice "controlla", e
  **Ancora umida** evita di bagnare per forza.
- **Web Push scritto a mano** (`_shared/webpush.js`): RFC 8291 e 8292 con WebCrypto, verificato nei test e contro la
  libreria di riferimento `http_ece`. Niente dipendenze npm nella funzione oltre a supabase-js.
- **Una foto per pianta, non una galleria**: serve a riconoscerla, non a seguirne la crescita. Una foto nuova
  sostituisce la vecchia, che si cancella dallo storage. Stesso codice di compressione dell'Armadio.

## Licenze

Inter: SIL Open Font License 1.1 (`src/assets/OFL-Inter.txt`). Icone: Lucide, licenza ISC.
