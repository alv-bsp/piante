-- Piante · cron dei promemoria
-- Da eseguire una volta nel SQL Editor, DOPO aver pubblicato la funzione "promemoria" e impostato i suoi secret
-- (README, passo 4). Prima sostituisci i due valori tra < >:
--   <project-ref>  la parte prima di .supabase.co nel Project URL
--   <CRON_SECRET>  lo stesso valore dato alla funzione (lo stampa `npm run chiavi`)
--
-- Ogni ora, al minuto 0, Postgres chiama la funzione. È la funzione a decidere se per te è l'ora del promemoria
-- (la scegli nell'app, di base le 9 di Roma) e a mandarlo una volta sola al giorno.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- URL e segreto stanno nel Vault, non nel testo del job.
select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/promemoria', 'piante_promemoria_url');
select vault.create_secret('<CRON_SECRET>', 'piante_cron_secret');

select cron.schedule(
  'piante-promemoria',
  '0 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'piante_promemoria_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'piante_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);

-- Controlli utili:
--   select * from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'piante-promemoria')
--     order by start_time desc limit 5;
--   select status_code, content from net._http_response order by created desc limit 5;
-- Per fermarlo:   select cron.unschedule('piante-promemoria');
-- Per cambiare il segreto: select vault.update_secret(
--   (select id from vault.secrets where name = 'piante_cron_secret'), '<nuovo>');
