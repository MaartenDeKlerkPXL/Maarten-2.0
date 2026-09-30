-- Optionele link per gewoonte (bv. de leeromgeving voor Spaans / Project Management).
alter table public.habits add column url text check (url is null or url ~* '^https?://');
