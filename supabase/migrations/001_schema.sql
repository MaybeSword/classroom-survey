-- =============================================================================
-- 001_schema.sql — Classroom Survey core schema
-- Source of truth: DATABASE.md (see DECISIONS.md D3).
-- =============================================================================

-- pgcrypto supplies gen_random_bytes(), which is used for unguessable public
-- slugs (002_functions.sql). Supabase installs it in the "extensions" schema.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- surveys: one row per survey. status drives the lifecycle
-- (draft -> active -> closed -> archived). public_slug is the short public id
-- used in /s/:slug. Only activate_survey() sets it.
-- -----------------------------------------------------------------------------
create table surveys (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    description text,
    status text not null default 'draft'
        check (status in ('draft', 'active', 'closed', 'archived')),
    public_slug text unique,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index surveys_status_idx on surveys(status);

-- At most one survey can be active. The index covers only rows where
-- status = 'active', so a second active row would violate uniqueness.
create unique index only_one_active_survey
on surveys ((status))
where status = 'active';

-- -----------------------------------------------------------------------------
-- questions: belong to a survey. Deleting the survey deletes its questions.
-- -----------------------------------------------------------------------------
create table questions (
    id uuid primary key default gen_random_uuid(),
    survey_id uuid not null references surveys(id) on delete cascade,
    question_text text not null,
    question_type text not null
        check (question_type in ('multiple_choice', 'true_false')),
    position integer not null,
    created_at timestamptz not null default now()
);

create index questions_survey_id_idx on questions(survey_id);

-- -----------------------------------------------------------------------------
-- choices: answer options for a question. True/false questions also get two
-- rows, "True" and "False" (DECISIONS.md D4).
-- -----------------------------------------------------------------------------
create table choices (
    id uuid primary key default gen_random_uuid(),
    question_id uuid not null references questions(id) on delete cascade,
    choice_text text not null,
    position integer not null,
    created_at timestamptz not null default now()
);

create index choices_question_id_idx on choices(question_id);

-- -----------------------------------------------------------------------------
-- responses: one student submission to one survey.
-- anonymous_token is a random id stored in the student's browser. It is used
-- only to block repeat submissions.
-- -----------------------------------------------------------------------------
create table responses (
    id uuid primary key default gen_random_uuid(),
    survey_id uuid not null references surveys(id) on delete cascade,
    anonymous_token text,
    submitted_at timestamptz not null default now()
);

create index responses_survey_id_idx on responses(survey_id);
create index responses_submitted_at_idx on responses(submitted_at);

-- One submission per browser token per survey. submit_survey_response()
-- always sends a token, so this index applies to every real submission.
create unique index responses_unique_student_per_survey
on responses(survey_id, anonymous_token)
where anonymous_token is not null;

-- -----------------------------------------------------------------------------
-- answers: one answer to one question within a response.
-- choice_id uses "on delete set null", as written in DATABASE.md. The editor
-- RPC refuses to change questions or choices once responses exist
-- (DECISIONS.md D7), so in practice this rule does not fire.
-- text_answer is reserved for future short-answer questions.
-- -----------------------------------------------------------------------------
create table answers (
    id uuid primary key default gen_random_uuid(),
    response_id uuid not null references responses(id) on delete cascade,
    question_id uuid not null references questions(id) on delete cascade,
    choice_id uuid references choices(id) on delete set null,
    text_answer text,
    created_at timestamptz not null default now(),
    unique (response_id, question_id)
);

create index answers_response_id_idx on answers(response_id);
create index answers_question_id_idx on answers(question_id);
create index answers_choice_id_idx on answers(choice_id);

-- -----------------------------------------------------------------------------
-- updated_at trigger: refreshes surveys.updated_at on every update.
-- -----------------------------------------------------------------------------
create or replace function update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger surveys_updated_at
before update on surveys
for each row
execute function update_updated_at_column();

-- -----------------------------------------------------------------------------
-- Row Level Security: enabled on every table. With RLS on, each role can see
-- or change only the rows that a policy below allows.
-- -----------------------------------------------------------------------------
alter table surveys   enable row level security;
alter table questions enable row level security;
alter table choices   enable row level security;
alter table responses enable row level security;
alter table answers   enable row level security;

-- -----------------------------------------------------------------------------
-- Anonymous (student) policies: read-only access to the active survey and its
-- questions and choices. Responses and answers have no anon policies, so
-- students can never read results. Submissions go only through
-- submit_survey_response() (002), which runs as security definer.
-- -----------------------------------------------------------------------------
create policy "students read active surveys"
on surveys for select to anon
using (status = 'active');

create policy "students read active survey questions"
on questions for select to anon
using (
    exists (
        select 1 from surveys
        where surveys.id = questions.survey_id
          and surveys.status = 'active'
    )
);

create policy "students read active survey choices"
on choices for select to anon
using (
    exists (
        select 1
        from questions
        join surveys on surveys.id = questions.survey_id
        where questions.id = choices.question_id
          and surveys.status = 'active'
    )
);

-- Extra safety on top of RLS: remove anon's table-level write privileges.
-- (Supabase grants them by default. Without a policy RLS blocks writes anyway,
-- but this keeps a policy added by mistake later from opening a hole.)
revoke insert, update, delete, truncate on surveys, questions, choices, responses, answers from anon;
revoke select on responses, answers from anon;

-- -----------------------------------------------------------------------------
-- Authenticated (instructor) policies: full access to every table.
-- SECURITY NOTE: this trusts *every* signed-in user. Turn off public sign-ups
-- in Supabase Auth (Authentication -> Providers -> Email -> disable
-- "Allow new users to sign up") and create the instructor account by hand.
-- See DECISIONS.md D10.
-- -----------------------------------------------------------------------------
create policy "authenticated manage surveys"
on surveys for all to authenticated using (true) with check (true);

create policy "authenticated manage questions"
on questions for all to authenticated using (true) with check (true);

create policy "authenticated manage choices"
on choices for all to authenticated using (true) with check (true);

create policy "authenticated manage responses"
on responses for all to authenticated using (true) with check (true);

create policy "authenticated manage answers"
on answers for all to authenticated using (true) with check (true);
