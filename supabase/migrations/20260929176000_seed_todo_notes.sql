-- Start-taken mogen notities en het event-vlag bevatten.

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r record;
begin
  insert into public.settings (user_id) values (new.id);

  insert into public.categories (user_id, slug, name, color, sort) values
    (new.id, 'school',      'School',      '#A1A1AA', 1),
    (new.id, 'werk',        'Werk',        '#3B82F6', 2),
    (new.id, 'roda',        'Roda JC',     '#FACC15', 3),
    (new.id, 'f1',          'Formule 1',   '#EF4444', 4),
    (new.id, 'vrienden',    'Vrienden',    '#22C55E', 5),
    (new.id, 'familie',     'Familie',     '#EC4899', 6),
    (new.id, 'sport',       'Sport',       '#F97316', 7),
    (new.id, 'studie',      'Studie',      '#A855F7', 8),
    (new.id, 'persoonlijk', 'Persoonlijk', '#14B8A6', 9),
    (new.id, 'overig',      'Overig',      '#64748B', 10);

  insert into public.habits (user_id, name, emoji, color, frequency, target_per_week, planned_days, backup_days, timer_minutes, sort) values
    (new.id, 'Spaans',             '🇪🇸', '#F59E0B', 'daily',  7, '{}',      '{}',  null, 1),
    (new.id, 'Tinder',             '🔥', '#FF4458', 'daily',  7, '{}',      '{}',  15,   2),
    (new.id, 'Bumble',             '🐝', '#FFC629', 'daily',  7, '{}',      '{}',  15,   3),
    (new.id, 'Sporten',            '💪', '#F97316', 'weekly', 2, '{3,7}',   '{4}', null, 4),
    (new.id, 'Project Management', '📊', '#A855F7', 'weekly', 3, '{1,3,5}', '{}',  null, 5);

  for r in select payload from public.seed_data where kind = 'schedule' loop
    insert into public.schedule_items (user_id, weekday, start_time, end_time, title, code, location, category_id, valid_from, valid_until)
    values (new.id, (r.payload->>'weekday')::smallint, (r.payload->>'start')::time, (r.payload->>'end')::time,
            r.payload->>'title', r.payload->>'code', r.payload->>'location',
            (select c.id from public.categories c
             where c.user_id = new.id and c.slug = coalesce(r.payload->>'category', 'school')),
            (r.payload->>'valid_from')::date, (r.payload->>'valid_until')::date);
  end loop;

  for r in select payload from public.seed_data where kind = 'birthday' loop
    insert into public.birthdays (user_id, name, day, month, year, is_self)
    values (new.id, r.payload->>'name', (r.payload->>'day')::smallint, (r.payload->>'month')::smallint,
            (r.payload->>'year')::smallint, coalesce((r.payload->>'is_self')::boolean, false));
  end loop;

  for r in select payload from public.seed_data where kind = 'recurring' loop
    insert into public.recurring_todos (user_id, title, frequency, weekday, day_of_month, due_time, is_event, remind_until_day, category_id)
    values (new.id, r.payload->>'title', coalesce(r.payload->>'frequency', 'monthly'), (r.payload->>'weekday')::smallint,
            (r.payload->>'day')::smallint, (r.payload->>'time')::time,
            coalesce((r.payload->>'is_event')::boolean, false), (r.payload->>'remind_until')::smallint,
            (select c.id from public.categories c
             where c.user_id = new.id and c.slug = coalesce(r.payload->>'category', 'overig')));
  end loop;
  perform public._generate_recurring(new.id);

  for r in select payload from public.seed_data where kind = 'todo' loop
    insert into public.todos (user_id, title, notes, is_event, due_date, due_time, remind_days_before, category_id)
    values (new.id, r.payload->>'title', r.payload->>'notes', coalesce((r.payload->>'is_event')::boolean, false),
            (r.payload->>'date')::date, (r.payload->>'time')::time,
            coalesce((select array_agg(x::smallint) from jsonb_array_elements_text(r.payload->'remind') x), '{}'),
            (select c.id from public.categories c
             where c.user_id = new.id and c.slug = coalesce(r.payload->>'category', 'overig')));
  end loop;

  return new;
end $$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
