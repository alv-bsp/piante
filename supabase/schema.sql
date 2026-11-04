-- Piante · schema v1
-- Da eseguire una volta nel SQL Editor di Supabase. Pensato per lo stesso progetto dell'Armadio (tabelle con nomi
-- diversi, stesso login), ma funziona anche in un progetto nuovo: ping() per il keep-alive viene creata se manca.
-- Le tabelle nuove non sono esposte alle API senza GRANT esplicito: i grant sono qui sotto.

-- ─── Piante ─────────────────────────────────────────────────────────
create table public.piante (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome           text not null check (char_length(btrim(nome)) between 1 and 60),
  tipo           text check (char_length(tipo) <= 40),                 -- Monstera, Ficus, Begonia…
  stanza         text not null check (char_length(btrim(stanza)) between 1 and 40),
  vaso           text check (char_length(vaso) <= 80),
  substrato      text not null default 'terra' check (substrato in ('terra', 'idroponica')),
  giorni_estate  smallint not null default 7  check (giorni_estate between 1 and 90),    -- aprile–settembre
  giorni_inverno smallint not null default 14 check (giorni_inverno between 1 and 120),  -- ottobre–marzo
  note           text check (char_length(note) <= 2000),
  archiviata_il  timestamptz,      -- tolta di casa: sparisce dagli elenchi, lo storico resta
  creata_il      timestamptz not null default now(),
  modificata_il  timestamptz not null default now()
);
create index piante_user_idx on public.piante (user_id);

-- ─── Cure: ogni annaffiatura o controllo ────────────────────────────
-- "controllata" = controllata e ancora umida (o livello dell'acqua a posto): sposta il promemoria di qualche giorno.
create table public.cure (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pianta_id uuid not null references public.piante (id) on delete cascade,
  tipo      text not null check (tipo in ('bagnata', 'controllata')),
  il        timestamptz not null default now()
);
create index cure_pianta_idx on public.cure (pianta_id, il desc);
create index cure_user_idx on public.cure (user_id);

-- Ultima annaffiatura e ultimo controllo di ogni pianta. security_invoker: valgono le RLS di chi legge.
create view public.ultime_cure with (security_invoker = true) as
  select pianta_id,
         max(il) filter (where tipo = 'bagnata')     as ultima_bagnata,
         max(il) filter (where tipo = 'controllata') as ultimo_controllo
  from public.cure
  group by pianta_id;

-- ─── Promemoria: impostazioni per utente ────────────────────────────
create table public.promemoria (
  user_id      uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  ora          smallint not null default 9 check (ora between 0 and 23),   -- ora di Roma
  ultimo_invio date                                                          -- lo scrive la funzione promemoria
);

-- ─── Dispositivi iscritti alle notifiche ────────────────────────────
create table public.push_iscrizioni (
  endpoint    text primary key check (endpoint ~ '^https://'),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  p256dh      text not null check (char_length(p256dh) between 80 and 100),
  auth        text not null check (char_length(auth) between 16 and 30),
  app_url     text not null check (app_url ~ '^https?://'),   -- dove porta il tocco sulla notifica
  dispositivo text check (char_length(dispositivo) <= 80),
  creata_il   timestamptz not null default now(),
  usata_il    timestamptz                                       -- ultimo invio riuscito
);
create index push_iscrizioni_user_idx on public.push_iscrizioni (user_id);

-- ─── Data di modifica ───────────────────────────────────────────────
create function public.piante_modificata() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.modificata_il := now();
  return new;
end $$;
revoke execute on function public.piante_modificata() from public, anon, authenticated;

create trigger piante_modificata before update on public.piante
  for each row execute function public.piante_modificata();

-- ─── Permessi (grant) ───────────────────────────────────────────────
-- Prima si toglie tutto, poi si concede il minimo. anon (chi non ha fatto login) non vede niente.
revoke all on public.piante, public.cure, public.ultime_cure, public.promemoria, public.push_iscrizioni
  from anon, authenticated;
grant select, insert, update, delete on public.piante          to authenticated;
grant select, insert, delete         on public.cure            to authenticated;
grant select                         on public.ultime_cure     to authenticated;
grant select, insert, update         on public.promemoria      to authenticated;
grant select, insert, update, delete on public.push_iscrizioni to authenticated;

-- La funzione promemoria usa la chiave secret (ruolo service_role): salta le RLS, ma i grant le servono.
grant select                 on public.piante, public.cure, public.ultime_cure to service_role;
grant select, insert, update on public.promemoria                               to service_role;
grant select, update, delete on public.push_iscrizioni                          to service_role;

-- ─── Row Level Security ─────────────────────────────────────────────
alter table public.piante          enable row level security;
alter table public.cure            enable row level security;
alter table public.promemoria      enable row level security;
alter table public.push_iscrizioni enable row level security;

create policy "piante: solo le mie" on public.piante
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- La cura deve essere mia, e mia la pianta a cui si riferisce.
create policy "cure: solo le mie" on public.cure
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.piante p where p.id = pianta_id and p.user_id = (select auth.uid()))
  );

create policy "promemoria: solo il mio" on public.promemoria
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "push_iscrizioni: solo le mie" on public.push_iscrizioni
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ─── ping() per il keep-alive ───────────────────────────────────────
-- Nel progetto dell'Armadio esiste già: "or replace" la lascia identica.
create or replace function public.ping() returns text
language sql stable set search_path = '' as $$ select 'pong'::text $$;
revoke execute on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;
