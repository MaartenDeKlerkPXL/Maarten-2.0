-- Cijfer per opgeslagen site: 1 = wellicht bruikbaar, 2 = mooi/waarschijnlijk bruikbaar, 3 = wauw/zeker bruikbaar.
alter table public.inspiration add column rating smallint check (rating between 1 and 3);

-- Awwwards is alleen voor laptop/Mac: geen pushmelding (die zou op de telefoon binnenkomen).
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
    end if;
  end loop;
end $$;
revoke execute on function public.claim_fitness_notifications() from public, anon, authenticated;
