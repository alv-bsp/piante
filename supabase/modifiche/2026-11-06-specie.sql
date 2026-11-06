-- Piante · specie aggiunte da te (6 novembre 2026)
-- Da eseguire una volta nel SQL Editor, sopra lo schema già installato. Le specie con la foto sono nel codice
-- (src/specie.js); qui ci sono solo quelle che aggiungi tu, con il programma di concime (src/concimi.js).

create table public.specie_mie (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome       text not null check (char_length(btrim(nome)) between 1 and 40),
  concime    text not null default 'verdi'
             check (concime in ('verdi', 'fiorite', 'succulente', 'agrumi', 'frutto', 'nessuno')),
  creata_il  timestamptz not null default now()
);
create unique index specie_mie_nome_idx on public.specie_mie (user_id, lower(nome));

revoke all on public.specie_mie from anon, authenticated;
grant select, insert, update, delete on public.specie_mie to authenticated;

alter table public.specie_mie enable row level security;

create policy "specie_mie: solo le mie" on public.specie_mie
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
