-- Projecten (gevoed door todo.md in GitHub-repo's of handmatig) en het Nederlands elftal in de agenda.
-- De repolijst zelf staat NIET in deze (publieke) repo: die wordt los in Supabase ingevoerd.

-- ───────────────────────── Oranje ─────────────────────────
alter table public.todos drop constraint todos_source_check;
alter table public.todos add constraint todos_source_check check (source in ('user', 'f1', 'roda', 'recurring', 'oranje'));

alter table public.settings
  add column oranje_push boolean not null default true,
  add column project_week_push boolean not null default true;

insert into public.categories (user_id, slug, name, color, sort)
select s.user_id, 'oranje', 'Oranje', '#FF7A00', coalesce((select max(c.sort) from public.categories c where c.user_id = s.user_id), 0) + 1
from public.settings s
on conflict (user_id, slug) do nothing;

-- ───────────────────────── Projecten ─────────────────────────
create table public.project_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  type text not null check (type in ('github', 'handmatig')),
  repo_owner text,
  repo_name text,
  naam text not null check (length(naam) between 1 and 120),
  categorie text,
  kleur text not null default '#3B82F6',
  volgorde int not null default 0,
  focus_deze_week boolean not null default false,
  gepauzeerd boolean not null default false,
  beschrijving text,
  standaard_branch text,
  todo_pad text,
  laatste_sync timestamptz,
  sync_status text not null default 'nieuw' check (sync_status in ('nieuw', 'ok', 'geen_todo', 'fout')),
  sync_fout text,
  etag text,
  created_at timestamptz not null default now(),
  check (type = 'handmatig' or (repo_owner is not null and repo_name is not null)),
  unique (user_id, repo_owner, repo_name)
);

create table public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.project_sources on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  sectie text,
  tekst text not null check (length(tekst) between 1 and 1000),
  afgerond boolean not null default false,
  prioriteit smallint not null default 0 check (prioriteit between 0 and 3),
  tags text[] not null default '{}',
  deadline date,
  volgorde int not null default 0,
  bron text not null default 'handmatig' check (bron in ('github', 'handmatig')),
  created_at timestamptz not null default now()
);
create index project_tasks_project_idx on public.project_tasks (project_id, volgorde);
create index project_tasks_user_deadline_idx on public.project_tasks (user_id, deadline) where deadline is not null;

create table public.project_progress (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.project_sources on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  datum date not null,
  voortgang numeric(5, 4) not null check (voortgang between 0 and 1),
  afgerond int not null default 0,
  totaal int not null default 0,
  unique (project_id, datum)
);
create index project_progress_user_idx on public.project_progress (user_id, datum);
create index project_sources_user_idx on public.project_sources (user_id, volgorde);

alter table public.project_sources enable row level security;
alter table public.project_tasks enable row level security;
alter table public.project_progress enable row level security;

create policy "eigen data" on public.project_sources for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "eigen data" on public.project_progress for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- todo.md is de bron van waarheid: GitHub-taken zijn alleen-lezen, handmatige taken mag ik zelf beheren
create policy "eigen taken lezen" on public.project_tasks for select to authenticated
  using (user_id = (select auth.uid()));
create policy "handmatige taken toevoegen" on public.project_tasks for insert to authenticated
  with check (user_id = (select auth.uid()) and bron = 'handmatig');
create policy "handmatige taken wijzigen" on public.project_tasks for update to authenticated
  using (user_id = (select auth.uid()) and bron = 'handmatig') with check (user_id = (select auth.uid()) and bron = 'handmatig');
create policy "handmatige taken verwijderen" on public.project_tasks for delete to authenticated
  using (user_id = (select auth.uid()) and bron = 'handmatig');

-- "Ligt stil": voortgang (en aantal afgevinkte taken) in 14 dagen niet veranderd.
-- Projecten zonder taken of die al af zijn tellen niet mee. Zelfde regel als isStalled() in de app.
create or replace function public.project_is_stil(p uuid, today date) returns boolean
language sql stable set search_path = '' as $$
  with ref as (
    select datum, voortgang, afgerond from public.project_progress
    where project_id = p and datum <= today - 14 order by datum desc limit 1
  ), latest as (
    select voortgang, totaal from public.project_progress where project_id = p order by datum desc limit 1
  )
  select exists (select 1 from ref)
     and exists (select 1 from latest where totaal > 0 and voortgang < 1)
     and not exists (
       select 1 from public.project_progress pp, ref
       where pp.project_id = p and pp.datum > ref.datum and (pp.voortgang <> ref.voortgang or pp.afgerond <> ref.afgerond))
$$;

-- ───────────────────────── Meldingen ─────────────────────────
create or replace function public.claim_project_notifications()
returns table (n_user uuid, n_key text, n_title text, n_body text, n_url text)
language plpgsql security definer set search_path = '' as $$
declare
  s record; td record; now_local timestamp; today date; k text; focus text; stil text; dl text;
  mnames text[] := array['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
  dnames text[] := array['ma','di','wo','do','vr','za','zo'];
begin
  for s in
    select st.* from public.settings st
    where exists (select 1 from public.push_subscriptions p where p.user_id = st.user_id)
      and exists (select 1 from public.project_sources ps where ps.user_id = st.user_id)
  loop
    now_local := now() at time zone s.timezone;
    today := now_local::date;

    -- Weekoverzicht: maandag 08:30
    if s.project_week_push and extract(isodow from today) = 1
       and now_local::time - time '08:30' >= interval '0' and now_local::time - time '08:30' < interval '3 hours' then
      k := 'projweek:' || today;
      if public._claim(s.user_id, k) then
        select string_agg(p.naam || coalesce(' → ' || (
                 select t.tekst from public.project_tasks t
                 where t.project_id = p.id and not t.afgerond order by t.volgorde limit 1), ''), '; ' order by p.volgorde)
        into focus
        from public.project_sources p where p.user_id = s.user_id and p.focus_deze_week;

        select string_agg(p.naam, ', ' order by p.volgorde) into stil
        from public.project_sources p
        where p.user_id = s.user_id and not p.gepauzeerd and public.project_is_stil(p.id, today);

        select string_agg(x.tekst || ' (' || x.naam || ', ' || dnames[extract(isodow from x.deadline)::int] || ' '
                          || extract(day from x.deadline)::int || ' ' || mnames[extract(month from x.deadline)::int] || ')', '; '
                          order by x.deadline)
        into dl
        from (
          select t.tekst, t.deadline, p.naam from public.project_tasks t join public.project_sources p on p.id = t.project_id
          where t.user_id = s.user_id and not t.afgerond and t.deadline between today and today + 7
          order by t.deadline limit 6
        ) x;

        n_user := s.user_id; n_key := k; n_url := '/projecten';
        n_title := '📁 Je projecten deze week';
        n_body := concat_ws(E'\n', 'Deze week: ' || focus, 'Ligt stil: ' || stil, 'Deadlines: ' || dl);
        if n_body = '' then n_body := 'Nog geen focusprojecten gekozen. Kies er max. 3 op de Projecten-pagina.'; end if;
        return next;
      end if;
    end if;

    -- Deadlines van projecttaken: 2 weken, 1 week en 1 dag van tevoren
    if now_local::time >= s.morning_time then
      for td in
        select t.project_id, t.tekst, t.deadline, t.deadline - today as d, p.naam
        from public.project_tasks t join public.project_sources p on p.id = t.project_id
        where t.user_id = s.user_id and not t.afgerond and t.deadline - today in (14, 7, 1)
      loop
        k := 'ptask:' || td.project_id || ':' || md5(td.tekst) || ':' || td.deadline || ':' || td.d;
        if public._claim(s.user_id, k) then
          n_user := s.user_id; n_key := k; n_url := '/projecten/' || td.project_id;
          n_title := '📁 ' || case td.d when 1 then 'Morgen' when 7 then 'Over 1 week' else 'Over 2 weken' end || ': ' || td.tekst;
          n_body := td.naam || ' · deadline ' || extract(day from td.deadline)::int || ' '
                    || mnames[extract(month from td.deadline)::int] || ' ' || extract(year from td.deadline)::int;
          return next;
        end if;
      end loop;
    end if;
  end loop;
end $$;
revoke execute on function public.claim_project_notifications() from public, anon, authenticated;

create or replace function public.dispatch_notifications() returns void
language plpgsql security definer set search_path = '' as $$
declare payload jsonb;
begin
  select jsonb_agg(jsonb_build_object('user_id', n_user, 'key', n_key, 'title', n_title, 'body', n_body, 'url', n_url))
  into payload
  from (
    select * from public.claim_due_notifications()
    union all select * from public.claim_fitness_notifications()
    union all select * from public.claim_project_notifications()
  ) n;
  if payload is not null then
    perform public.call_function('send-push', jsonb_build_object('notifications', payload));
  end if;
end $$;
revoke execute on function public.dispatch_notifications() from public, anon, authenticated;

-- Oranje krijgt dezelfde meldingen als Roda JC (zelfde voorlooptijd), met een eigen schakelaar
do $$
declare def text;
begin
  select pg_get_functiondef('public.claim_due_notifications()'::regprocedure) into def;
  if position('when td.source in (''f1'', ''roda'')' in def) = 0
     or position('when ''roda'' then ''⚽ ''' in def) = 0
     or position('and x.due_time is not null and x.due_date between today - 1 and today + 1' in def) = 0 then
    raise exception 'claim_due_notifications: verwachte tekst niet gevonden';
  end if;
  def := replace(def, 'when td.source in (''f1'', ''roda'')', 'when td.source in (''f1'', ''roda'', ''oranje'')');
  def := replace(def, 'when ''roda'' then ''⚽ ''', 'when ''roda'' then ''⚽ '' when ''oranje'' then ''🦁 ''');
  def := replace(def, 'and x.due_time is not null and x.due_date between today - 1 and today + 1',
                      'and x.due_time is not null and x.due_date between today - 1 and today + 1 and (x.source <> ''oranje'' or s.oranje_push)');
  execute def;
end $$;
revoke execute on function public.claim_due_notifications() from public, anon, authenticated;

-- todo.md's 2x per dag ophalen, op dezelfde tijden als F1/Roda/Oranje
select cron.schedule('sync-projects', '15 4,16 * * *', $$select public.call_function('sync-project-todos')$$);
