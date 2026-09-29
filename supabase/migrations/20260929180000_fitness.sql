-- Fitness (warming-up + krachttraining) en pushups met opbouwschema.

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  -- weight: kg × reps · assist: hulpgewicht (minder = beter) · reps: eigen gewicht · time: seconden · cardio: tijd + afstand/niveau
  kind text not null check (kind in ('weight', 'assist', 'reps', 'time', 'cardio')),
  grp text not null default 'kracht' check (grp in ('warmup', 'kracht', 'core')),
  increment_kg numeric(4, 1) not null default 2.5,
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index exercises_user_idx on public.exercises (user_id);

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  workout_date date not null,
  notes text,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
create index workouts_user_date_idx on public.workouts (user_id, workout_date);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  workout_id uuid not null references public.workouts on delete cascade,
  exercise_id uuid not null references public.exercises on delete cascade,
  set_no smallint not null default 1,
  weight_kg numeric(6, 2),
  reps smallint,
  seconds int,
  distance_km numeric(6, 2),
  level smallint,
  created_at timestamptz not null default now()
);
create index workout_sets_workout_idx on public.workout_sets (workout_id);
create index workout_sets_exercise_idx on public.workout_sets (exercise_id);
create index workout_sets_user_idx on public.workout_sets (user_id);

create table public.pushup_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  log_date date not null,
  reps smallint not null check (reps between -500 and 500 and reps <> 0),
  created_at timestamptz not null default now()
);
create index pushup_logs_user_date_idx on public.pushup_logs (user_id, log_date);

alter table public.settings
  add column pushup_start_date date not null default current_date,
  add column pushup_start_target smallint not null default 20,
  add column pushup_step smallint not null default 5,
  add column pushup_goal smallint not null default 100,
  add column pushup_current_target smallint not null default 20;

do $$
declare t text;
begin
  foreach t in array array['exercises', 'workouts', 'workout_sets', 'pushup_logs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format($p$create policy "eigen data" on public.%I for all to authenticated
                     using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))$p$, t);
  end loop;
end $$;

-- Standaard oefeningen
create or replace function public.seed_fitness(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.exercises where user_id = p_user) then return; end if;
  insert into public.exercises (user_id, name, kind, grp, increment_kg, sort) values
    (p_user, 'Fietsen',            'cardio', 'warmup', 0,   1),
    (p_user, 'Loopband',           'cardio', 'warmup', 0,   2),
    (p_user, 'Hardlopen',          'cardio', 'warmup', 0,   3),
    (p_user, 'Seated row',         'weight', 'kracht', 2.5, 10),
    (p_user, 'Chest press beneden','weight', 'kracht', 2.5, 11),
    (p_user, 'Pec fly',            'weight', 'kracht', 2.5, 12),
    (p_user, 'Chest press',        'weight', 'kracht', 2.5, 13),
    (p_user, 'Chin assist',        'assist', 'kracht', 2.5, 14),
    (p_user, 'Biceps',             'weight', 'kracht', 2.5, 15),
    (p_user, 'Triceps',            'weight', 'kracht', 2.5, 16),
    (p_user, 'Leg curl',           'weight', 'kracht', 2.5, 17),
    (p_user, 'Leg extension',      'weight', 'kracht', 2.5, 18),
    (p_user, 'Leg press',          'weight', 'kracht', 5,   19),
    (p_user, 'Optrekken',          'reps',   'kracht', 0,   20),
    (p_user, 'Planken',            'time',   'core',   0,   30),
    (p_user, 'Stairs',             'cardio', 'core',   0,   31);
end $$;
revoke execute on function public.seed_fitness(uuid) from public, anon, authenticated;

create or replace function public.handle_new_user_fitness() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.seed_fitness(new.id);
  return new;
end $$;
revoke execute on function public.handle_new_user_fitness() from public, anon, authenticated;

create trigger on_auth_user_created_fitness after insert on auth.users
  for each row execute function public.handle_new_user_fitness();

select public.seed_fitness(id) from auth.users;

-- Extra meldingen: pushups ('s avonds als het dagdoel nog niet gehaald is)
create or replace function public.claim_fitness_notifications()
returns table (n_user uuid, n_key text, n_title text, n_body text, n_url text)
language plpgsql security definer set search_path = '' as $$
declare
  s record; now_local timestamp; today date; done int; k text;
begin
  for s in
    select st.* from public.settings st
    where exists (select 1 from public.push_subscriptions p where p.user_id = st.user_id)
  loop
    now_local := now() at time zone s.timezone;
    today := now_local::date;
    if now_local::time >= s.reminder_time and now_local::time < s.reminder_time + interval '3 hours' then
      select coalesce(sum(reps), 0) into done from public.pushup_logs where user_id = s.user_id and log_date = today;
      if done < s.pushup_current_target then
        k := 'pushups:' || today;
        if public._claim(s.user_id, k) then
          n_user := s.user_id; n_key := k; n_url := '/';
          n_title := '💪 Pushups: nog ' || (s.pushup_current_target - done) || ' te gaan';
          n_body := done || ' van ' || s.pushup_current_target || ' gedaan vandaag. Op weg naar ' || s.pushup_goal || '!';
          return next;
        end if;
      end if;
    end if;
  end loop;
end $$;
revoke execute on function public.claim_fitness_notifications() from public, anon, authenticated;

create or replace function public.dispatch_notifications() returns void
language plpgsql security definer set search_path = '' as $$
declare payload jsonb;
begin
  select jsonb_agg(jsonb_build_object('user_id', n_user, 'key', n_key, 'title', n_title, 'body', n_body, 'url', n_url))
  into payload
  from (select * from public.claim_due_notifications() union all select * from public.claim_fitness_notifications()) n;
  if payload is not null then
    perform public.call_function('send-push', jsonb_build_object('notifications', payload));
  end if;
end $$;
revoke execute on function public.dispatch_notifications() from public, anon, authenticated;
