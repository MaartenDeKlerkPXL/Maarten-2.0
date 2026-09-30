-- Awwwards Site of the Day: elke dag automatisch opgehaald, jij kiest "opslaan" of "niet mooi".

create table public.inspiration (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  sotd_date date not null,
  name text not null,
  url text,
  awwwards_url text,
  image_url text,
  description text,
  categories text[] not null default '{}',
  tags text[] not null default '{}',
  technologies text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'saved', 'skipped')),
  note text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, sotd_date)
);
create index inspiration_user_status_idx on public.inspiration (user_id, status, sotd_date);

alter table public.inspiration enable row level security;
create policy "eigen data" on public.inspiration for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Melding 's avonds als de Site of the Day van vandaag nog niet bekeken is (naast pushups).
create or replace function public.claim_fitness_notifications()
returns table (n_user uuid, n_key text, n_title text, n_body text, n_url text)
language plpgsql security definer set search_path = '' as $$
declare
  s record; now_local timestamp; today date; done int; k text; site text;
begin
  for s in
    select st.* from public.settings st
    where exists (select 1 from public.push_subscriptions p where p.user_id = st.user_id)
  loop
    now_local := now() at time zone s.timezone;
    today := now_local::date;
    if now_local::time - s.reminder_time >= interval '0' and now_local::time - s.reminder_time < interval '3 hours' then
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

      select i.name into site from public.inspiration i
      where i.user_id = s.user_id and i.status = 'pending' and i.sotd_date >= today - 1
      order by i.sotd_date desc limit 1;
      if site is not null then
        k := 'awwwards:' || today;
        if public._claim(s.user_id, k) then
          n_user := s.user_id; n_key := k; n_url := '/';
          n_title := '🎨 Site of the Day: ' || site;
          n_body := 'Nog even bekijken? Mooi = opslaan, anders overslaan.';
          return next;
        end if;
      end if;
    end if;
  end loop;
end $$;
revoke execute on function public.claim_fitness_notifications() from public, anon, authenticated;

select cron.schedule('sync-awwwards', '5 5,11,17 * * *', $$select public.call_function('sync-awwwards')$$);
