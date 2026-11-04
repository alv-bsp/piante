# Piante

Webapp personale per le piante di casa: dove sono, quando le ho bagnate, quando controllarle.
Un solo utente, pensata per il telefono e installabile sulla schermata Home. Sorella dell'Armadio per lo stack;
lo stile è suo: verde profondo, superfici in vetro, un solo accento verde acceso, font Plus Jakarta Sans.

- **Frontend**: Vite + JavaScript senza framework, pubblicato su GitHub Pages da GitHub Actions a ogni push su `main`.
- **Backend**: lo stesso progetto Supabase dell'Armadio (piano gratuito). Tabelle con nomi diversi, stesso login.
- **Promemoria**: notifiche push. Ogni ora `pg_cron` chiama la Edge Function `promemoria`; all'ora che scegli
  nell'app (di base le 9) ti arriva una notifica sola con le piante da controllare e i concimi da dare, solo se
  c'è qualcosa.

## Come funziona

- **Oggi**: le piante da controllare, dalla più in ritardo, con due pulsanti: **Bagnata** e **Ancora umida**
  (per l'idroponica: **Rabboccata** e **Livello ok**). Se c'è un concime da sciogliere nell'acqua, il pulsante
  diventa **Con concime** (sotto resta "Solo acqua"). Poi **Da concimare**, con i concimi da dare a parte
  (granulare, chelato, piante con irrigazione automatica), e le piante dei prossimi tre giorni.
- **Casa**: tutte le piante divise per stanza, con la foto della specie, l'ultima annaffiatura e una goccia per segnarla al volo.
  Accanto a ogni stanza con almeno due piante, **Bagna tutte**: elenco già spuntato, togli quelle saltate, conferma.
- **Scheda**: foto, stato, "bagnata un altro giorno", dati della pianta, storico (una voce sbagliata si cancella).
- **Foto**: una foto generica per specie, scelta in `src/specie.js` e servita dal CDN di Unsplash. Nel modulo si
  sceglie la specie tra quelle note (o "Altra", con il tipo scritto a mano); le piante già salvate la ricavano da
  tipo e nome, quindi "Ficus", "Ficus lyrata" e "ficus lirata" danno la stessa foto.
- Ogni azione si può annullare dal messaggio che compare in basso.

Regole (in `supabase/functions/_shared/scadenze.js`, le stesse per app e notifiche):

- Una pianta va controllata quando sono passati N giorni dall'ultima annaffiatura: N estivo da aprile a settembre,
  invernale da ottobre a marzo. Si ragiona in giorni di calendario a Roma.
- **Ancora umida** sposta il controllo di un terzo di N (almeno 2 giorni).
- Una pianta mai segnata conta dal giorno in cui l'hai aggiunta.
- **Concime**: ogni pianta ha zero o più cicli, uno per prodotto: ogni quanti giorni e in quali mesi (anche a
  cavallo dell'anno). Fuori dai mesi il ciclo è a riposo. All'inizio dei mesi è subito da dare, a meno che l'ultima
  volta sia ancora recente; un ciclo appena creato aspetta il suo intervallo. Un concime "sciolto nell'acqua" su una
  pianta bagnata a mano non ha un promemoria suo: si dà alla prossima annaffiatura, e segnarlo segna anche l'acqua.
- **Irrigazione automatica** (melo e limone, ci pensa Home Assistant): niente promemoria per l'acqua, solo concime.
- **Togli dalla casa** la archivia: sparisce dagli elenchi e dai promemoria, lo storico resta.
  Da Account › Piante tolte si rimette o si elimina per sempre.

## Passi manuali, una volta sola

0. **Repo GitHub**: `alv-bsp/piante`, pubblico, vuoto (senza README né .gitignore).
   Dalla cartella del progetto: `git push -u origin main` (il remote `origin` è già impostato).
1. **Supabase** (progetto dell'Armadio) → **SQL Editor** → incolla ed esegui `supabase/schema.sql`.
2. **Chiavi**: `npm install`, poi `npm run chiavi`. Stampa `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `CRON_SECRET`.
   Non le salva da nessuna parte: tienile aperte fino al passo 5.
3. **Token Supabase** (dal telefono, se sul Mac Supabase è bloccato): supabase.com/dashboard/account/tokens →
   Generate new token → nome `github-piante` → copia il valore.
4. **Cron**: apri `supabase/cron.sql`, sostituisci `<project-ref>` e `<CRON_SECRET>`, eseguilo nel SQL Editor.
   Non salvare il file con il segreto dentro: va eseguito, non committato.
5. **GitHub → repo → Settings → Secrets and variables → Actions**:
   - tab **Variables**: `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` (gli stessi valori dell'Armadio),
     `VAPID_PUBLIC_KEY` (passo 2)
   - tab **Secrets**: `SUPABASE_ACCESS_TOKEN` (passo 3), `VAPID_PRIVATE_KEY` e `CRON_SECRET` (passo 2)

   Poi **Actions → Pubblica funzione promemoria → Run workflow**: pubblica la funzione e i suoi secret su Supabase
   (`.github/workflows/funzione.yml`). Riparte da solo quando cambia `supabase/functions/`.
6. **GitHub → Settings → Pages** → Source: **GitHub Actions**. Poi `git push` (o rilancia "Deploy su Pages").
   Quando è verde l'app è su `https://alv-bsp.github.io/piante/`.
7. **Sull'iPhone**: apri l'indirizzo in Safari → Condividi → **Aggiungi alla schermata Home**, apri l'app da lì e accedi
   con l'account dell'Armadio. Poi:
   - **Carica le mie piante** (le 15 di partenza, melo e limone compresi, da `src/partenza.js`) e sistema le stanze da Casa;
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
- Le foto delle specie arrivano da `images.unsplash.com`: Unsplash vede le richieste delle immagini, nient'altro.
  Il bucket `piante` e le colonne `foto`/`miniatura` dello schema restano dalla versione con le foto personali e non
  sono più usati.
- La funzione `promemoria` è pubblicata senza verifica JWT del gateway e si autorizza da sola: il cron con
  `x-cron-secret` (confronto a tempo costante), l'app con il token di login. Usa la chiave secret del progetto, che
  Supabase le inietta da sé e non esce mai dalla funzione. Manda richieste solo ai servizi push di Apple, Google,
  Mozilla e Microsoft.
- La chiave privata VAPID e il `CRON_SECRET` stanno nei Secrets di GitHub e nei secret della funzione (il segreto del
  cron anche nel Vault). La chiave pubblica VAPID non è segreta.
- `SUPABASE_ACCESS_TOKEN` dà accesso a tutto l'account Supabase: sta solo nei Secrets di GitHub, e il workflow parte
  solo su push a `main` o a mano, mai dalle pull request. Si può revocare dopo il primo deploy e ricrearlo quando
  cambia la funzione.
- `vite.config.js` ferma la build se al posto della publishable arriva una chiave secret o service_role.

## Limiti e manutenzione

- **Pausa dopo 7 giorni di inattività** del progetto Supabase: lo tiene sveglio il keep-alive dell'Armadio, e qui c'è
  lo stesso workflow (`keepalive.yml`) come riserva. GitHub li disattiva dopo 60 giorni senza commit nel repo.
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
src/specie.js                      specie note, regole per riconoscerle, foto Unsplash
src/partenza.js                    le piante di partenza, con i loro cicli di concime
src/tempo.js                       date in parole
src/viste/                         Oggi, Casa, Bagna tutte, scheda, editor, account, accesso
supabase/schema.sql                tabelle, viste ultime_cure e ultime_concimazioni, grant, RLS, bucket delle foto
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
- **Concime a cicli per prodotto**: una pianta di casa ne ha uno, il melo due in mesi diversi (sangue di bue
  ad aprile e maggio, Fortigo da giugno ad agosto), il limone due negli stessi mesi (granulare tre volte l'anno e
  chelato di ferro ogni 30 giorni). Ogni ciclo conta dalla sua ultima volta, così i due del limone non si pestano i
  piedi. Il nome del prodotto si copia nello storico: togliere un ciclo non cancella le concimazioni fatte.
- **Concime nell'acqua alla prossima annaffiatura**: concimare un vaso col terriccio ancora umido non ha senso, quindi
  il Compo non ti chiama da solo, si aggancia all'annaffiatura.
- **Foto per specie, non per pianta**: belle, uniformi e senza fatica. Prese da Unsplash (licenza libera, solo foto
  non Unsplash+), scelte a mano tra quelle con una pianta sola e un fondo pulito. Restano sul loro CDN, che le ritaglia
  alla misura giusta (`fotoSpecie()`); se un giorno una sparisce, al suo posto resta il riquadro di vetro.
- **Nuovo stile, stessa UX**: le schermate e i flussi sono quelli di prima; cambiano colori, superfici, tipografia e la
  barra in basso (cerchi: Oggi, Casa, Aggiungi, Account).

## Licenze

Plus Jakarta Sans: SIL Open Font License 1.1 (`src/assets/OFL-PlusJakartaSans.txt`). Icone: Lucide, licenza ISC.
Foto: Unsplash, licenza Unsplash (https://unsplash.com/license). Gli id delle foto sono in `src/specie.js`; ogni foto
si apre su `https://images.unsplash.com/photo-<id>`.
