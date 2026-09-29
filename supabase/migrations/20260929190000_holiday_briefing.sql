-- Geen lessen in het ochtendoverzicht op Belgische feestdagen (zoals in de agenda),
-- en eigen events (bv. werkdiensten) blijven in de agenda staan i.p.v. naar het archief.

create or replace function public.easter(y int) returns date
language plpgsql immutable set search_path = '' as $$
declare a int; b int; c int; d int; e int; f int; g int; h int; i int; k int; l int; m int;
begin
  a := y % 19; b := y / 100; c := y % 100; d := b / 4; e := b % 4; f := (b + 8) / 25; g := (b - f + 1) / 3;
  h := (19 * a + b - d - g + 15) % 30; i := c / 4; k := c % 4; l := (32 + 2 * e + 2 * i - h - k) % 7;
  m := (a + 11 * h + 22 * l) / 451;
  return make_date(y, (h + l - 7 * m + 114) / 31, ((h + l - 7 * m + 114) % 31) + 1);
end $$;

create or replace function public.is_be_holiday(d date) returns boolean
language sql immutable set search_path = '' as $$
  select to_char(d, 'MM-DD') in ('01-01', '05-01', '07-11', '07-21', '08-15', '11-01', '11-11', '12-25')
      or (d - public.easter(extract(year from d)::int)) in (0, 1, 39, 49, 50)
$$;

create or replace function public.daily_maintenance() returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public._generate_recurring();
  update public.todos x set archived_at = now()
  from public.settings s
  where s.user_id = x.user_id and x.archived_at is null and (
    (x.done_at is not null and x.done_at < now() - make_interval(days => s.archive_after_days))
    or (x.is_event and x.source <> 'user' and x.done_at is null and x.due_date < (now() at time zone s.timezone)::date - 1)
  );
  delete from public.notification_log where sent_at < now() - interval '120 days';
  delete from public.habit_timers where ends_at < now() - interval '1 day';
end $$;
revoke execute on function public.daily_maintenance() from public, anon, authenticated;

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
        left join public.categories sc on sc.id = si.category_id
        where si.user_id = s.user_id and si.weekday = dow
          and (si.valid_from is null or si.valid_from <= today)
          and (si.valid_until is null or si.valid_until >= today)
          and not (sc.slug = 'school' and public.is_be_holiday(today));
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

    -- ── Terugkerende taken: op de dag zelf + dagelijks nazeuren tot remind_until_day
    if now_local::time >= s.morning_time then
      for td in
        select x.id, x.title, x.due_date, x.due_time, x.is_event, r.remind_until_day
        from public.todos x join public.recurring_todos r on r.id = x.recurring_id
        where x.user_id = s.user_id and x.done_at is null and x.archived_at is null
          and x.due_date between today - 31 and today
      loop
        k := null;
        if td.due_date = today and td.due_time is null then
          k := 'recur0:' || td.id;
          n_title := case when td.is_event then '📅 ' else '📝 ' end || td.title;
          n_body := case when td.is_event then 'Vandaag is het zover!' else 'Staat vandaag op je lijst.' end;
        elsif not td.is_event and td.remind_until_day is not null
              and date_trunc('month', td.due_date) = date_trunc('month', today)
              and extract(day from today) <= td.remind_until_day then
          k := 'recur:' || td.id || ':' || today;
          n_title := '🔔 Al gedaan? ' || td.title;
          n_body := 'Nog niet afgevinkt. Vink hem af zodra het gelukt is ✅';
        end if;
        if k is not null then
          if public._claim(s.user_id, k) then
            n_user := s.user_id; n_key := k; n_url := '/todo';
            return next;
          end if;
        end if;
      end loop;
    end if;

    -- ── Vooraf herinneren (bv. 14, 7 en 1 dag voor een deadline)
    if now_local::time >= s.morning_time then
      for td in
        select x.id, x.title, x.due_date, x.due_date - today as d
        from public.todos x
        where x.user_id = s.user_id and x.done_at is null and x.archived_at is null
          and cardinality(x.remind_days_before) > 0 and x.due_date > today
          and (x.due_date - today) = any (x.remind_days_before)
      loop
        k := 'pre:' || td.id || ':' || td.due_date || ':' || td.d;
        if public._claim(s.user_id, k) then
          n_user := s.user_id; n_key := k; n_url := '/todo';
          n_title := '📅 ' || case when td.d = 1 then 'Morgen' when td.d = 7 then 'Over 1 week'
                                   when td.d = 14 then 'Over 2 weken' else 'Over ' || td.d || ' dagen' end
                     || ': ' || td.title;
          n_body := 'Deadline ' || extract(day from td.due_date)::int || ' ' || mnames[extract(month from td.due_date)::int]
                    || ' ' || extract(year from td.due_date)::int;
          return next;
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

revoke execute on function public.claim_due_notifications() from public, anon, authenticated;
