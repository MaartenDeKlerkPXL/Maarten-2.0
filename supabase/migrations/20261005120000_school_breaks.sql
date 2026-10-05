-- Geen lessen in het ochtendoverzicht tijdens Vlaamse schoolvakanties en PXL-sluitingsdagen
-- (zelfde lijst als SCHOOL_BREAKS in src/lib/holidays.ts).
create or replace function public.is_pxl_free_day(d date) returns boolean
language sql immutable set search_path = '' as $$
  select public.is_be_holiday(d) or exists (
    select 1 from (values
      ('2026-11-02'::date, '2026-11-08'::date),
      ('2026-12-18', '2026-12-18'),
      ('2026-12-21', '2027-01-03'),
      ('2027-02-08', '2027-02-14'),
      ('2027-03-29', '2027-04-11'),
      ('2027-05-07', '2027-05-07'),
      ('2027-07-01', '2027-08-31'),
      ('2027-11-01', '2027-11-07'),
      ('2027-12-27', '2028-01-09')
    ) v(s, e) where d between v.s and v.e)
$$;

do $$
declare def text;
begin
  select pg_get_functiondef('public.claim_due_notifications()'::regprocedure) into def;
  if position('public.is_be_holiday(today)' in def) = 0 then
    raise exception 'claim_due_notifications: is_be_holiday(today) niet gevonden';
  end if;
  execute replace(def, 'public.is_be_holiday(today)', 'public.is_pxl_free_day(today)');
end $$;
revoke execute on function public.claim_due_notifications() from public, anon, authenticated;
