-- Piante · diario di crescita (5 novembre 2026)
-- Da eseguire una volta nel SQL Editor, sopra lo schema già installato. Le foto vanno nel bucket "piante",
-- che esiste già con le sue regole (ogni file nella cartella del proprio user_id).

create table public.diario (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pianta_id  uuid not null references public.piante (id) on delete cascade,
  giorno     date not null default current_date,
  foto       text not null,     -- percorso nel bucket: <user_id>/<pianta_id>/<versione>.<webp|jpg>
  miniatura  text not null,
  nota       text check (char_length(nota) <= 300),
  creata_il  timestamptz not null default now()
);
create index diario_pianta_idx on public.diario (pianta_id, giorno desc);

revoke all on public.diario from anon, authenticated;
grant select, insert, update, delete on public.diario to authenticated;

alter table public.diario enable row level security;

create policy "diario: solo il mio" on public.diario
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.piante p where p.id = pianta_id and p.user_id = (select auth.uid()))
  );
