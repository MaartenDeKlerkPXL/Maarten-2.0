-- Registratie: alleen het allereerste account mag bestaan (persoonlijke app).
-- Dat account wordt direct bevestigd zodat inloggen meteen werkt.
create or replace function public.guard_signup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from auth.users) then
    raise exception 'Registratie is gesloten';
  end if;
  new.email_confirmed_at := coalesce(new.email_confirmed_at, now());
  return new;
end $$;

create trigger guard_signup before insert on auth.users
  for each row execute function public.guard_signup();

-- Standaarddata voor een nieuw account.
-- Persoonlijke startdata (rooster, verjaardagen) staat alleen in public.seed_data in de database.
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

  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

revoke execute on function public.guard_signup() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
