-- Fixtures for scripts/rls-check.ts. Run in the Supabase SQL editor (as the
-- project owner) before the check, and run rls_cleanup.sql afterwards.
-- WARNING: this ACTIVATES a test survey, which closes any survey that is
-- active right now. Don't run it during class.
update surveys set status = 'closed' where status = 'active';

insert into surveys (id, title, status, public_slug) values
  ('11111111-1111-4111-8111-111111111111', 'RLS check: active', 'draft', 'rlsact'),
  ('22222222-2222-4222-8222-222222222222', 'RLS check: draft',  'draft', null),
  ('33333333-3333-4333-8333-333333333333', 'RLS check: closed', 'draft', 'rlsclo');

insert into questions (id, survey_id, question_text, question_type, position) values
  ('11111111-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'RLS question', 'true_false', 1),
  ('33333333-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333', 'RLS question', 'true_false', 1);

insert into choices (id, question_id, choice_text, position) values
  ('11111111-0000-4000-8000-0000000000c1', '11111111-0000-4000-8000-000000000001', 'True', 1),
  ('11111111-0000-4000-8000-0000000000c2', '11111111-0000-4000-8000-000000000001', 'False', 2),
  ('33333333-0000-4000-8000-0000000000c1', '33333333-0000-4000-8000-000000000001', 'True', 1),
  ('33333333-0000-4000-8000-0000000000c2', '33333333-0000-4000-8000-000000000001', 'False', 2);

-- draft -> active and draft -> active -> closed, following the status rules.
update surveys set status = 'active' where id = '33333333-3333-4333-8333-333333333333';
update surveys set status = 'closed' where id = '33333333-3333-4333-8333-333333333333';
update surveys set status = 'active' where id = '11111111-1111-4111-8111-111111111111';
