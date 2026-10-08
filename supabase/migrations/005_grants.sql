-- 005_grants.sql : grant table and schema permissions to anon and authenticated roles
-- Row Level Security (RLS) on each table ensures users can only access their authorized rows.

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to anon;

grant usage, select on all sequences in schema public to authenticated;
grant usage, select on all sequences in schema public to anon;

grant execute on all routines in schema public to authenticated;
grant execute on all routines in schema public to anon;

alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant all on routines to anon, authenticated;
