-- Minimal stand-ins for the roles Supabase provides, so the migrations can run
-- on a plain Postgres container. Not used on a real Supabase project.
create role anon nologin;
create role authenticated nologin;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
