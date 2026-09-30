-- Lat pulldown: stappen van 5 kg.
update public.exercises set increment_kg = 5 where name = 'Lat pulldown';

create or replace function public.seed_fitness(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  machine numeric[] := '{27,32,36,41,45,50,54,59,63,68,72,77,81,86,90}';
  arms numeric[] := '{11,13,16,18,21,23,26,28,31,33,36,38,41,43,46,48}';
begin
  if exists (select 1 from public.exercises where user_id = p_user) then return; end if;
  insert into public.exercises (user_id, name, kind, grp, increment_kg, sort, weight_steps) values
    (p_user, 'Fietsen',        'cardio', 'warmup', 0,   1,  null),
    (p_user, 'Loopband',       'cardio', 'warmup', 0,   2,  null),
    (p_user, 'Hardlopen',      'cardio', 'warmup', 0,   3,  null),
    (p_user, 'Seated row',     'weight', 'kracht', 2.5, 10, machine),
    (p_user, 'Lat pulldown',   'weight', 'kracht', 5,   11, null),
    (p_user, 'Pec fly',        'weight', 'kracht', 2.5, 12, machine),
    (p_user, 'Chest press',    'weight', 'kracht', 2.5, 13, machine),
    (p_user, 'Shoulder press', 'weight', 'kracht', 2,   14, null),
    (p_user, 'Biceps',         'weight', 'kracht', 2.5, 15, arms),
    (p_user, 'Triceps',        'weight', 'kracht', 2.5, 16, arms),
    (p_user, 'Leg curl',       'weight', 'kracht', 2.5, 17, machine),
    (p_user, 'Leg extension',  'weight', 'kracht', 2.5, 18, machine),
    (p_user, 'Leg press',      'weight', 'kracht', 5,   19, machine),
    (p_user, 'Optrekken',      'reps',   'kracht', 0,   20, null),
    (p_user, 'Planken',        'time',   'core',   0,   30, null),
    (p_user, 'Stairs',         'cardio', 'core',   0,   31, null);
end $$;
revoke execute on function public.seed_fitness(uuid) from public, anon, authenticated;
