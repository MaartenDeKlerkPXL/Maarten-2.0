-- seed_data krijgt een primary key (advisor)
alter table public.seed_data add column id bigint generated always as identity primary key;
