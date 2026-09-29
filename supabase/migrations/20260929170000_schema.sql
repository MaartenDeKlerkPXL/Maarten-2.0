-- Maarten 2.0 – schema
-- Eén gebruiker per account, alles afgeschermd met RLS (user_id = auth.uid()).

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- ───────────────────────── Instellingen ─────────────────────────
create table public.settings (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  display_name text not null default 'Maarten',
  timezone text not null default 'Europe/Amsterdam',
  morning_time time not null default '08:00',
  reminder_time time not null default '20:00',
  todo_reminder_minutes int not null default 15,
  event_reminder_minutes int not null default 60,
  birthday_days_before int not null default 14,
  archive_after_days int not null default 7,
  water_goal_ml int not null default 2300 check (water_goal_ml between 500 and 6000),
  water_reminders boolean not null default true,
  water_start time not null default '09:00',
  water_end time not null default '21:00',
  created_at timestamptz not null default now()
);

-- ───────────────────────── Categorieën ─────────────────────────
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  slug text not null,
  name text not null,
  color text not null,
  sort int not null default 0,
  unique (user_id, slug)
);

-- ───────────────────────── Todo's & agenda-items ─────────────────────────
create table public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null check (length(title) between 1 and 500),
  notes text,
  category_id uuid references public.categories on delete set null,
  priority smallint not null default 0 check (priority between 0 and 3),
  due_date date,
  due_time time,
  end_time time,
  location text,
  done_at timestamptz,
  archived_at timestamptz,
  source text not null default 'user' check (source in ('user', 'f1', 'roda')),
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source, external_id)
);
create index todos_user_open_idx on public.todos (user_id, archived_at, due_date);

-- ───────────────────────── Vast (school)rooster ─────────────────────────
create table public.schedule_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  weekday smallint not null check (weekday between 1 and 7), -- 1 = maandag
  start_time time not null,
  end_time time not null,
  title text not null,
  code text,
  location text,
  category_id uuid references public.categories on delete set null,
  valid_from date,
  valid_until date,
  created_at timestamptz not null default now()
);

-- ───────────────────────── Gewoontes ─────────────────────────
create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  emoji text not null default '✅',
  color text not null default '#4F8CFF',
  frequency text not null default 'daily' check (frequency in ('daily', 'weekly')),
  target_per_week smallint not null default 7 check (target_per_week between 1 and 7),
  planned_days smallint[] not null default '{}', -- 1 = maandag … 7 = zondag
  backup_days smallint[] not null default '{}',
  timer_minutes smallint check (timer_minutes between 1 and 240),
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  habit_id uuid not null references public.habits on delete cascade,
  log_date date not null,
  created_at timestamptz not null default now(),
  unique (habit_id, log_date)
);
create index habit_logs_user_date_idx on public.habit_logs (user_id, log_date);

create table public.habit_timers (
  habit_id uuid primary key references public.habits on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  started_at timestamptz not null default now(),
  ends_at timestamptz not null
);

-- ───────────────────────── Waterpeil (drinken) ─────────────────────────
create table public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  log_date date not null,
  ml int not null check (ml between -2000 and 3000 and ml <> 0),
  label text,
  created_at timestamptz not null default now()
);
create index water_logs_user_date_idx on public.water_logs (user_id, log_date);

-- ───────────────────────── Verjaardagen ─────────────────────────
create table public.birthdays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  day smallint not null check (day between 1 and 31),
  month smallint not null check (month between 1 and 12),
  year smallint check (year between 1900 and 2100),
  is_self boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

-- ───────────────────────── Push ─────────────────────────
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create table public.notification_log (
  user_id uuid not null references auth.users on delete cascade,
  key text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- Server-only tabellen (geen policies ⇒ alleen service_role)
create table public.app_secrets (
  key text primary key,
  value text not null
);

create table public.seed_data (
  kind text not null,
  payload jsonb not null
);

-- ───────────────────────── RLS ─────────────────────────
do $$
declare t text;
begin
  foreach t in array array['settings','categories','todos','schedule_items','habits','habit_logs',
                           'habit_timers','birthdays','push_subscriptions','notification_log',
                           'water_logs','app_secrets','seed_data']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;

  foreach t in array array['settings','categories','todos','schedule_items','habits','habit_logs',
                           'habit_timers','birthdays','push_subscriptions','water_logs']
  loop
    execute format($p$create policy "eigen data" on public.%I for all to authenticated
                     using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))$p$, t);
  end loop;
end $$;

create policy "eigen log lezen" on public.notification_log for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.app_secrets, public.seed_data from anon, authenticated;

-- updated_at bijhouden
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger todos_touch before update on public.todos
  for each row execute function public.touch_updated_at();

-- indexen op foreign keys
create index todos_category_idx on public.todos (category_id);
create index schedule_items_user_idx on public.schedule_items (user_id);
create index schedule_items_category_idx on public.schedule_items (category_id);
create index habits_user_idx on public.habits (user_id);
create index habit_logs_habit_idx on public.habit_logs (habit_id);
create index habit_timers_user_idx on public.habit_timers (user_id);
create index birthdays_user_idx on public.birthdays (user_id);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
