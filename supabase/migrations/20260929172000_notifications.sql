-- Meldingen + onderhoud + cron.
-- public.app_secrets bevat (alleen server): functions_url, anon_key, cron_secret,
-- vapid_public_key, vapid_private_jwk, vapid_subject.

create or replace function public.safe_date(y int, m int, d int) returns date
language sql immutable set search_path = '' as $$
  select make_date(y, m, least(d, extract(day from (make_date(y, m, 1) + interval '1 month - 1 day'))::int))
$$;

create or replace function public.next_birthday(p_day int, p_month int, p_from date) returns date
language sql immutable set search_path = '' as $$
  select case when x.d >= p_from then x.d
              else public.safe_date(extract(year from p_from)::int + 1, p_month, p_day) end
  from (select public.safe_date(extract(year from p_from)::int, p_month, p_day) as d) x
$$;

-- Registreert een melding als verstuurd; true als hij nog niet eerder verstuurd was.
create or replace function public._claim(p_user uuid, p_key text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notification_log (user_id, key) values (p_user, p_key) on conflict do nothing;
  return found;
end $$;

create or replace function public.claim_due_notifications()
returns table (n_user uuid, n_key text, n_title text, n_body text, n_url text)
language plpgsql security definer set search_path = '' as $$
declare
  s record; t record; b record; td record;
  now_local timestamp; today date; dow int; week_start date;
  txt text; txt2 text; drunk int; frac numeric; hr int; lead int; days int; age int; k text;
  mnames text[] := array['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
begin
  -- Timers: afgelopen timers vinken de gewoonte automatisch af.
  for t in
    select ht.habit_id, ht.user_id, ht.started_at, ht.ends_at, h.name, h.emoji, st.timezone
    from public.habit_timers ht
    join public.habits h on h.id = ht.habit_id
    join public.settings st on st.user_id = ht.user_id
    where ht.ends_at <= now()
  loop
    insert into public.habit_logs (user_id, habit_id, log_date)
    values (t.user_id, t.habit_id, (t.ends_at at time zone t.timezone)::date)
    on conflict do nothing;
    delete from public.habit_timers where habit_id = t.habit_id;
    if exists (select 1 from public.push_subscriptions p where p.user_id = t.user_id) then
      k := 'timer:' || t.habit_id || ':' || extract(epoch from t.ends_at)::bigint;
      if public._claim(t.user_id, k) then
        n_user := t.user_id; n_key := k; n_url := '/';
        n_title := t.emoji || ' ' || t.name || ' klaar!';
        n_body := round(extract(epoch from t.ends_at - t.started_at) / 60) || ' minuten zitten erop. Automatisch afgevinkt ✅';
        return next;
      end if;
    end if;
  end loop;

  for s in
    select st.* from public.settings st
    where exists (select 1 from public.push_subscriptions p where p.user_id = st.user_id)
  loop
    now_local := now() at time zone s.timezone;
    today := now_local::date;
    dow := extract(isodow from today)::int;
    week_start := today - (dow - 1);

    -- ── Ochtendoverzicht
    if now_local::time >= s.morning_time and now_local::time < s.morning_time + interval '3 hours' then
      k := 'morning:' || today;
      if public._claim(s.user_id, k) then
        select string_agg(to_char(si.start_time, 'HH24:MI') || ' ' || si.title, ', ' order by si.start_time) into txt
        from public.schedule_items si
        where si.user_id = s.user_id and si.weekday = dow
          and (si.valid_from is null or si.valid_from <= today)
          and (si.valid_until is null or si.valid_until >= today);
        select string_agg(coalesce(to_char(x.due_time, 'HH24:MI') || ' ', '') || x.title, ', ' order by x.due_time nulls first) into txt2
        from public.todos x
        where x.user_id = s.user_id and x.due_date = today and x.done_at is null and x.archived_at is null;
        n_user := s.user_id; n_key := k; n_url := '/';
        n_title := 'Goedemorgen ' || s.display_name || ' ☀️';
        n_body := concat_ws(E'\n', '🎓 ' || txt, '✅ ' || txt2);
        if n_body = '' then n_body := 'Geen lessen of taken vandaag. Tijd om te groeien 🚀'; end if;
        return next;
      end if;
    end if;

    -- ── Gewoontes die vandaag nog open staan
    if now_local::time >= s.reminder_time and now_local::time < s.reminder_time + interval '3 hours' then
      select string_agg(h.emoji || ' ' || h.name, ', ' order by h.sort) into txt
      from public.habits h
      where h.user_id = s.user_id and h.active
        and not exists (select 1 from public.habit_logs l where l.habit_id = h.id and l.log_date = today)
        and (
          h.frequency = 'daily'
          or (
            (select count(*) from public.habit_logs l where l.habit_id = h.id and l.log_date between week_start and today) < h.target_per_week
            and (
              dow = any (h.planned_days)
              or (dow = any (h.backup_days) and exists (
                    select 1 from unnest(h.planned_days) p
                    where p < dow and not exists (
                      select 1 from public.habit_logs l2 where l2.habit_id = h.id and l2.log_date = week_start + (p - 1))))
            )
          )
        );
      if txt is not null then
        k := 'habits:' || today;
        if public._claim(s.user_id, k) then
          n_user := s.user_id; n_key := k; n_url := '/';
          n_title := 'Nog even doorzetten 💪';
          n_body := 'Nog te doen: ' || txt;
          return next;
        end if;
      end if;
    end if;

    -- ── Waterpeil: om de 2 uur, alleen als je achterloopt op schema
    if s.water_reminders and now_local::time >= s.water_start and now_local::time < s.water_end then
      hr := extract(hour from now_local)::int;
      if hr > extract(hour from s.water_start)::int and (hr - extract(hour from s.water_start)::int) % 2 = 0 then
        select coalesce(sum(w.ml), 0) into drunk from public.water_logs w where w.user_id = s.user_id and w.log_date = today;
        frac := extract(epoch from (now_local::time - s.water_start)) / nullif(extract(epoch from (s.water_end - s.water_start)), 0);
        if drunk < s.water_goal_ml * coalesce(frac, 1) - 250 then
          k := 'water:' || today || ':' || hr;
          if public._claim(s.user_id, k) then
            n_user := s.user_id; n_key := k; n_url := '/';
            n_title := 'Waterpeil 💧';
            n_body := 'Je zit op ' || drunk || ' van ' || s.water_goal_ml || ' ml. Tijd voor een glas water!';
            return next;
          end if;
        end if;
      end if;
    end if;

    -- ── Verjaardagen
    if now_local::time >= s.morning_time then
      for b in
        select bd.*, public.next_birthday(bd.day, bd.month, today) as nb
        from public.birthdays bd where bd.user_id = s.user_id
      loop
        days := b.nb - today;
        age := case when b.year is not null then extract(year from b.nb)::int - b.year end;
        k := null;
        if days = 0 then
          k := 'bday0:' || b.id || ':' || b.nb;
          n_title := case when b.is_self then '🎉 Gefeliciteerd, ' || s.display_name || '!' else '🎉 ' || b.name || ' is vandaag jarig!' end;
          n_body := case when b.is_self then 'Maak er een mooie dag van.' else 'Vergeet niet te feliciteren' || coalesce(' (' || age || ' jaar)', '') || ' 🎂' end;
        elsif days = 1 and not b.is_self then
          k := 'bday1:' || b.id || ':' || b.nb;
          n_title := '🎁 Morgen is ' || b.name || ' jarig';
          n_body := 'Cadeau en kaartje geregeld?';
        elsif days between 2 and s.birthday_days_before and not b.is_self then
          k := 'bdayearly:' || b.id || ':' || b.nb;
          n_title := '🎂 ' || b.name || ' is over ' || days || ' dagen jarig';
          n_body := extract(day from b.nb)::int || ' ' || mnames[extract(month from b.nb)::int] || coalesce(' · wordt ' || age, '') || ' — tijd om een cadeau te regelen 🎁';
        end if;
        if k is not null then
          if public._claim(s.user_id, k) then
            n_user := s.user_id; n_key := k; n_url := '/meer/verjaardagen';
            return next;
          end if;
        end if;
      end loop;
    end if;

    -- ── Taken en wedstrijden/races met een tijd
    for td in
      select x.*, ((x.due_date + x.due_time) at time zone s.timezone) as start_ts
      from public.todos x
      where x.user_id = s.user_id and x.done_at is null and x.archived_at is null
        and x.due_time is not null and x.due_date between today - 1 and today + 1
    loop
      lead := case when td.source in ('f1', 'roda') then s.event_reminder_minutes else s.todo_reminder_minutes end;
      if now() >= td.start_ts - make_interval(mins => lead) and now() < td.start_ts + interval '5 minutes' then
        k := 'todo:' || td.id || ':' || td.due_date || 'T' || td.due_time;
        if public._claim(s.user_id, k) then
          n_user := s.user_id; n_key := k; n_url := '/todo';
          n_title := case td.source when 'f1' then '🏎️ ' when 'roda' then '⚽ ' else '⏰ ' end || td.title;
          n_body := 'Om ' || to_char(td.due_time, 'HH24:MI') || coalesce(' · ' || td.location, '');
          return next;
        end if;
      end if;
    end loop;
  end loop;
end $$;

-- Roept een edge function aan vanuit de database (cron).
create or replace function public.call_function(fn text, payload jsonb default '{}') returns bigint
language plpgsql security definer set search_path = '' as $$
declare base text; anon text; secret text;
begin
  select value into base from public.app_secrets where key = 'functions_url';
  select value into anon from public.app_secrets where key = 'anon_key';
  select value into secret from public.app_secrets where key = 'cron_secret';
  return net.http_post(
    url := base || '/' || fn,
    body := payload,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || anon, 'x-cron-secret', secret),
    timeout_milliseconds := 60000
  );
end $$;

create or replace function public.dispatch_notifications() returns void
language plpgsql security definer set search_path = '' as $$
declare payload jsonb;
begin
  select jsonb_agg(jsonb_build_object('user_id', n_user, 'key', n_key, 'title', n_title, 'body', n_body, 'url', n_url))
  into payload from public.claim_due_notifications();
  if payload is not null then
    perform public.call_function('send-push', jsonb_build_object('notifications', payload));
  end if;
end $$;

create or replace function public.daily_maintenance() returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- afgevinkt ⇒ na X dagen naar het archief; verlopen wedstrijden/races ⇒ archief
  update public.todos x set archived_at = now()
  from public.settings s
  where s.user_id = x.user_id and x.archived_at is null and (
    (x.done_at is not null and x.done_at < now() - make_interval(days => s.archive_after_days))
    or (x.source <> 'user' and x.done_at is null and x.due_date < (now() at time zone s.timezone)::date - 1)
  );
  delete from public.notification_log where sent_at < now() - interval '120 days';
  delete from public.habit_timers where ends_at < now() - interval '1 day';
end $$;

revoke execute on function public._claim(uuid, text) from public, anon, authenticated;
revoke execute on function public.claim_due_notifications() from public, anon, authenticated;
revoke execute on function public.call_function(text, jsonb) from public, anon, authenticated;
revoke execute on function public.dispatch_notifications() from public, anon, authenticated;
revoke execute on function public.daily_maintenance() from public, anon, authenticated;

select cron.schedule('notifications', '* * * * *', 'select public.dispatch_notifications()');
select cron.schedule('maintenance', '30 2 * * *', 'select public.daily_maintenance()');
select cron.schedule('sync-events', '15 4,16 * * *', $$select public.call_function('sync-events')$$);
