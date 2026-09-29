-- Terugkerende maandtaken (bv. uren invullen op de 1e, salaris op de 25e).

create table public.recurring_todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  notes text,
  category_id uuid references public.categories on delete set null,
  day_of_month smallint not null check (day_of_month between 1 and 31),
  due_time time,
  is_event boolean not null default false,
  remind_until_day smallint check (remind_until_day between 1 and 31),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index recurring_todos_user_idx on public.recurring_todos (user_id);
create index recurring_todos_category_idx on public.recurring_todos (category_id);

alter table public.recurring_todos enable row level security;
create policy "eigen data" on public.recurring_todos for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter table public.todos drop constraint todos_source_check;
alter table public.todos add constraint todos_source_check check (source in ('user', 'f1', 'roda', 'recurring'));
-- is_event: iets wat "gebeurt" (race, wedstrijd, uitbetaling) ⇒ na afloop automatisch naar archief
alter table public.todos add column is_event boolean not null default false;
alter table public.todos add column recurring_id uuid references public.recurring_todos on delete set null;
create index todos_recurring_idx on public.todos (recurring_id);
update public.todos set is_event = true where source in ('f1', 'roda');

-- Maakt de todo's voor deze en volgende maand aan (idempotent).
create or replace function public._generate_recurring(p_user uuid default null) returns int
language plpgsql security definer set search_path = '' as $$
declare
  r record; m int; due date; base date; n int := 0; tz text;
begin
  for r in
    select rt.*, s.timezone from public.recurring_todos rt
    join public.settings s on s.user_id = rt.user_id
    where rt.active and (p_user is null or rt.user_id = p_user)
  loop
    base := date_trunc('month', now() at time zone r.timezone)::date;
    for m in 0..1 loop
      due := public.safe_date(extract(year from base + make_interval(months => m))::int,
                              extract(month from base + make_interval(months => m))::int, r.day_of_month);
      continue when due < (r.created_at at time zone r.timezone)::date;
      insert into public.todos (user_id, title, notes, category_id, due_date, due_time, is_event, source, external_id, recurring_id)
      values (r.user_id, r.title, r.notes, r.category_id, due, r.due_time, r.is_event, 'recurring',
              r.id || ':' || to_char(due, 'YYYY-MM'), r.id)
      on conflict (user_id, source, external_id) do nothing;
      if found then n := n + 1; end if;
    end loop;
  end loop;
  return n;
end $$;

-- Voor de app: na het aanmaken/wijzigen van een terugkerende taak.
create or replace function public.generate_my_recurring() returns int
language sql security definer set search_path = '' as $$
  select public._generate_recurring((select auth.uid()))
$$;

revoke execute on function public._generate_recurring(uuid) from public, anon, authenticated;
revoke execute on function public.generate_my_recurring() from public, anon;
grant execute on function public.generate_my_recurring() to authenticated;

-- Onderhoud: ook terugkerende taken aanmaken; events na afloop archiveren.
create or replace function public.daily_maintenance() returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public._generate_recurring();
  update public.todos x set archived_at = now()
  from public.settings s
  where s.user_id = x.user_id and x.archived_at is null and (
    (x.done_at is not null and x.done_at < now() - make_interval(days => s.archive_after_days))
    or (x.is_event and x.done_at is null and x.due_date < (now() at time zone s.timezone)::date - 1)
  );
  delete from public.notification_log where sent_at < now() - interval '120 days';
  delete from public.habit_timers where ends_at < now() - interval '1 day';
end $$;
revoke execute on function public.daily_maintenance() from public, anon, authenticated;

select cron.unschedule('maintenance');
select cron.schedule('maintenance', '5 22,23 * * *', 'select public.daily_maintenance()');
