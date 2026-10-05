-- Stage (werkplekleren) volgt de Vlaamse schoolvakanties en feestdagen, maar niet de PXL-brugdagen.
create or replace function public.is_be_school_free(d date) returns boolean
language sql immutable set search_path = '' as $$
  select public.is_be_holiday(d) or exists (
    select 1 from (values
      ('2026-11-02'::date, '2026-11-08'::date),
      ('2026-12-21', '2027-01-03'),
      ('2027-02-08', '2027-02-14'),
      ('2027-03-29', '2027-04-11'),
      ('2027-07-01', '2027-08-31'),
      ('2027-11-01', '2027-11-07'),
      ('2027-12-27', '2028-01-09')
    ) v(s, e) where d between v.s and v.e)
$$;

create or replace function public.is_pxl_free_day(d date) returns boolean
language sql immutable set search_path = '' as $$
  select public.is_be_school_free(d) or d in ('2026-12-18'::date, '2027-05-07'::date)
$$;

do $$
declare def text; old text := 'not (sc.slug = ''school'' and public.is_pxl_free_day(today))';
begin
  select pg_get_functiondef('public.claim_due_notifications()'::regprocedure) into def;
  if position(old in def) = 0 then
    raise exception 'claim_due_notifications: schoolfilter niet gevonden';
  end if;
  execute replace(def, old,
    'not ((sc.slug = ''school'' and public.is_pxl_free_day(today)) or (sc.slug = ''stage'' and public.is_be_school_free(today)))');
end $$;
revoke execute on function public.claim_due_notifications() from public, anon, authenticated;
