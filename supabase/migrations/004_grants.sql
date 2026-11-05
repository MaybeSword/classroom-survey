-- =============================================================================
-- 004_grants.sql — explicit table privileges.
-- Supabase normally grants these by default ("Automatically expose new tables").
-- Granting them here makes the app work the same whether that project setting
-- is on or off. RLS policies (001) still decide which ROWS each role can touch.
-- =============================================================================
grant usage on schema public to anon, authenticated;

-- Instructors: full table access (rows filtered by the policies in 001).
grant select, insert, update, delete on surveys, questions, choices, responses, answers to authenticated;

-- Students: read-only on survey content. No access to responses or answers.
grant select on surveys, questions, choices to anon;
revoke insert, update, delete, truncate on surveys, questions, choices, responses, answers from anon;
revoke all on responses, answers from anon;
