-- Aftellen en "sinds": mijlpalen op de voorpagina (tot een datum) en tellers op Doelen (sinds een datum).
-- De eigen data staat alleen in de database, niet in deze repo.
create table public.countdowns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  titel text not null check (length(titel) between 1 and 120),
  emoji text not null default '📅',
  datum date not null,
  soort text not null check (soort in ('tot', 'sinds')),
  created_at timestamptz not null default now()
);
create index countdowns_user_idx on public.countdowns (user_id, datum);

alter table public.countdowns enable row level security;
create policy "eigen data" on public.countdowns for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
