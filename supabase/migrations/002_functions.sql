-- =============================================================================
-- 002_functions.sql — RPCs from API.md sections 7, 8, 9, 10, 11.
-- Every error is raised as an exception whose message is exactly one error
-- code (e.g. 'SURVEY_NOT_ACTIVE'). The frontend maps these codes to friendly
-- text (src/lib/errors.ts).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- generate_public_slug(): 6 random characters from an alphabet without
-- look-alikes (no 0/o, 1/l/i). Uses cryptographic random bytes, so slugs are
-- non-sequential and hard to guess. DECISIONS.md D2.
-- Internal helper: only authenticated (via activate_survey) gets execute.
-- -----------------------------------------------------------------------------
create or replace function generate_public_slug()
returns text
language plpgsql
volatile
security definer            -- so callers need no privileges on "extensions"
set search_path = public, extensions
as $$
declare
    alphabet constant text := '23456789abcdefghjkmnpqrstuvwxyz';
    bytes bytea := extensions.gen_random_bytes(6);
    result text := '';
    i int;
begin
    for i in 0..5 loop
        result := result || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
    end loop;
    return result;
end;
$$;

-- -----------------------------------------------------------------------------
-- activate_survey(p_survey_id)  — API.md §7. Instructor only.
-- In one transaction: validate the survey, close any other active survey,
-- assign a slug if the survey has none, and set it to active.
-- Returns {id, status, public_slug}.
-- -----------------------------------------------------------------------------
create or replace function activate_survey(p_survey_id uuid)
returns jsonb
language plpgsql
security invoker            -- runs with the caller's RLS (authenticated only)
set search_path = public
as $$
declare
    v_survey surveys%rowtype;
    v_slug text;
    v_tries int := 0;
begin
    -- Serialize activations so two clicks can't race each other.
    perform pg_advisory_xact_lock(hashtext('activate_survey'));

    select * into v_survey from surveys where id = p_survey_id for update;
    if not found then
        raise exception 'SURVEY_NOT_FOUND';
    end if;

    if v_survey.status = 'active' then
        return jsonb_build_object('id', v_survey.id, 'status', v_survey.status,
                                  'public_slug', v_survey.public_slug);
    end if;
    if v_survey.status = 'archived' then
        raise exception 'INVALID_STATUS_TRANSITION';   -- unarchive first (D6)
    end if;

    -- A survey must have at least one question, and every multiple-choice
    -- question needs at least two choices (D19).
    if not exists (select 1 from questions where survey_id = p_survey_id) then
        raise exception 'SURVEY_HAS_NO_QUESTIONS';
    end if;
    if exists (
        select 1 from questions q
        where q.survey_id = p_survey_id
          and (select count(*) from choices c where c.question_id = q.id) < 2
    ) then
        raise exception 'VALIDATION_ERROR';
    end if;

    -- 1. Close whatever is active now.
    update surveys set status = 'closed'
    where status = 'active' and id <> p_survey_id;

    -- 2. Assign a slug the first time. It is kept forever after, so a reopened
    --    survey reuses its old QR code.
    v_slug := v_survey.public_slug;
    while v_slug is null loop
        v_tries := v_tries + 1;
        v_slug := generate_public_slug();
        if exists (select 1 from surveys where public_slug = v_slug) then
            v_slug := null;
            if v_tries > 20 then
                raise exception 'SLUG_GENERATION_FAILED';
            end if;
        end if;
    end loop;

    -- 3. Activate.
    update surveys set status = 'active', public_slug = v_slug
    where id = p_survey_id;

    return jsonb_build_object('id', p_survey_id, 'status', 'active', 'public_slug', v_slug);
end;
$$;

-- -----------------------------------------------------------------------------
-- close_survey(p_survey_id)  — API.md §8. Instructor only.
-- Sets an active survey to closed. Submissions that start afterwards fail with
-- SURVEY_NOT_ACTIVE. A submission already running finishes first, because it
-- holds a share lock on the survey row (see submit_survey_response).
-- -----------------------------------------------------------------------------
create or replace function close_survey(p_survey_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_status text;
begin
    select status into v_status from surveys where id = p_survey_id for update;
    if not found then
        raise exception 'SURVEY_NOT_FOUND';
    end if;
    if v_status <> 'active' then
        raise exception 'SURVEY_NOT_ACTIVE';
    end if;

    update surveys set status = 'closed' where id = p_survey_id;
    return jsonb_build_object('id', p_survey_id, 'status', 'closed');
end;
$$;

-- -----------------------------------------------------------------------------
-- get_public_survey(p_slug)  — API.md §9, for anonymous students.
-- Returns one of:
--   {"status":"not_found"}
--   {"status":"closed"}                      (exists but not active; no content)
--   {"status":"active","survey":{...},"questions":[{...,"choices":[...]}]}
-- Runs as security definer so it can tell "closed" apart from "not found"
-- (anon RLS hides non-active surveys). It never returns response data.
-- DECISIONS.md D8.
-- -----------------------------------------------------------------------------
create or replace function get_public_survey(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_survey surveys%rowtype;
begin
    select * into v_survey from surveys where public_slug = p_slug;
    if not found then
        return jsonb_build_object('status', 'not_found');
    end if;
    if v_survey.status <> 'active' then
        return jsonb_build_object('status', 'closed');
    end if;

    return jsonb_build_object(
        'status', 'active',
        'survey', jsonb_build_object(
            'id', v_survey.id,
            'title', v_survey.title,
            'description', v_survey.description
        ),
        'questions', coalesce((
            select jsonb_agg(
                jsonb_build_object(
                    'id', q.id,
                    'question_text', q.question_text,
                    'question_type', q.question_type,
                    'position', q.position,
                    'choices', coalesce((
                        select jsonb_agg(jsonb_build_object(
                                   'id', c.id,
                                   'choice_text', c.choice_text,
                                   'position', c.position)
                               order by c.position)
                        from choices c where c.question_id = q.id
                    ), '[]'::jsonb)
                ) order by q.position)
            from questions q where q.survey_id = v_survey.id
        ), '[]'::jsonb)
    );
end;
$$;

-- -----------------------------------------------------------------------------
-- submit_survey_response(p_survey_id, p_anonymous_token, p_answers)
-- API.md §10 / DATABASE.md §11. For anonymous students.
-- Everything runs in one transaction (a function call is atomic), so either the
-- response and every answer are stored, or nothing is.
-- p_answers: [{"question_id": "...", "choice_id": "..."}, ...]
-- Error codes: SURVEY_NOT_ACTIVE, DUPLICATE_RESPONSE, INVALID_QUESTION,
--              INVALID_CHOICE, MISSING_REQUIRED_ANSWER, INVALID_REQUEST.
-- -----------------------------------------------------------------------------
create or replace function submit_survey_response(
    p_survey_id uuid,
    p_anonymous_token text,
    p_answers jsonb
)
returns jsonb
language plpgsql
security definer            -- anon has no INSERT privilege; this function does
set search_path = public
as $$
declare
    v_status text;
    v_response_id uuid;
    v_item jsonb;
    v_question_id uuid;
    v_choice_id uuid;
    v_seen uuid[] := '{}';
    v_total_questions int;
begin
    -- Basic shape checks.
    if p_anonymous_token is null or length(trim(p_anonymous_token)) = 0
       or length(p_anonymous_token) > 200 then
        raise exception 'INVALID_REQUEST';
    end if;
    if p_answers is null or jsonb_typeof(p_answers) <> 'array' then
        raise exception 'INVALID_REQUEST';
    end if;

    -- 1. The survey must be active. "for share" blocks close_survey() until
    --    this submission commits, and makes us wait for a close that is
    --    already in progress.
    select status into v_status from surveys where id = p_survey_id for share;
    if not found or v_status <> 'active' then
        raise exception 'SURVEY_NOT_ACTIVE';
    end if;

    -- 2. Duplicate token check (the unique index is the final guard; see 6).
    if exists (select 1 from responses
               where survey_id = p_survey_id and anonymous_token = p_anonymous_token) then
        raise exception 'DUPLICATE_RESPONSE';
    end if;

    -- 3 + 4. Each question must belong to this survey, appear at most once,
    --        and the chosen choice must belong to that question.
    for v_item in select * from jsonb_array_elements(p_answers) loop
        begin
            v_question_id := (v_item->>'question_id')::uuid;
            v_choice_id   := (v_item->>'choice_id')::uuid;
        exception when invalid_text_representation then
            raise exception 'INVALID_QUESTION';
        end;

        if v_question_id is null
           or v_question_id = any (v_seen)
           or not exists (select 1 from questions
                          where id = v_question_id and survey_id = p_survey_id) then
            raise exception 'INVALID_QUESTION';
        end if;

        if v_choice_id is null
           or not exists (select 1 from choices
                          where id = v_choice_id and question_id = v_question_id) then
            raise exception 'INVALID_CHOICE';
        end if;

        v_seen := v_seen || v_question_id;
    end loop;

    -- 5. Every question is required (DECISIONS.md D5).
    select count(*) into v_total_questions from questions where survey_id = p_survey_id;
    if coalesce(array_length(v_seen, 1), 0) <> v_total_questions then
        raise exception 'MISSING_REQUIRED_ANSWER';
    end if;

    -- 6. Insert the response and its answers. The unique index catches a
    --    duplicate that raced past the check in step 2.
    begin
        insert into responses (survey_id, anonymous_token)
        values (p_survey_id, p_anonymous_token)
        returning id into v_response_id;
    exception when unique_violation then
        raise exception 'DUPLICATE_RESPONSE';
    end;

    insert into answers (response_id, question_id, choice_id)
    select v_response_id,
           (e->>'question_id')::uuid,
           (e->>'choice_id')::uuid
    from jsonb_array_elements(p_answers) e;

    return jsonb_build_object('success', true, 'response_id', v_response_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- get_survey_results(p_survey_id)  — API.md §11. Instructor only.
-- Per question: answered count, unanswered count, and per choice the count
-- and percentage. Percentage = choice count / answers to that question,
-- rounded to 1 decimal place. 0 when nobody answered (no division by zero).
-- DECISIONS.md D13.
-- -----------------------------------------------------------------------------
create or replace function get_survey_results(p_survey_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
    v_survey surveys%rowtype;
    v_total int;
begin
    select * into v_survey from surveys where id = p_survey_id;
    if not found then
        raise exception 'SURVEY_NOT_FOUND';
    end if;

    select count(*) into v_total from responses where survey_id = p_survey_id;

    return jsonb_build_object(
        'survey_id', v_survey.id,
        'title', v_survey.title,
        'description', v_survey.description,
        'status', v_survey.status,
        'public_slug', v_survey.public_slug,
        'created_at', v_survey.created_at,
        'response_count', v_total,
        'questions', coalesce((
            select jsonb_agg(qrow order by qpos)
            from (
                select q.position as qpos,
                       jsonb_build_object(
                           'question_id', q.id,
                           'question_text', q.question_text,
                           'question_type', q.question_type,
                           'position', q.position,
                           'response_count', qa.answered,
                           'unanswered_count', greatest(v_total - qa.answered, 0),
                           'choices', coalesce((
                               select jsonb_agg(jsonb_build_object(
                                          'choice_id', c.id,
                                          'choice_text', c.choice_text,
                                          'position', c.position,
                                          'count', cc.n,
                                          'percentage', case when qa.answered = 0 then 0
                                                        else round(cc.n * 100.0 / qa.answered, 1) end)
                                      order by c.position)
                               from choices c
                               cross join lateral (
                                   select count(*)::int as n from answers a where a.choice_id = c.id
                               ) cc
                               where c.question_id = q.id
                           ), '[]'::jsonb)
                       ) as qrow
                from questions q
                cross join lateral (
                    select count(*)::int as answered
                    from answers a where a.question_id = q.id and a.choice_id is not null
                ) qa
                where q.survey_id = p_survey_id
            ) s
        ), '[]'::jsonb)
    );
end;
$$;

-- -----------------------------------------------------------------------------
-- Permissions. Postgres gives EXECUTE to PUBLIC by default, and Supabase also
-- grants it to anon/authenticated, so revoke everything first, then grant
-- exactly what each role needs.
-- -----------------------------------------------------------------------------
revoke all on function generate_public_slug()                 from public, anon, authenticated;
revoke all on function activate_survey(uuid)                  from public, anon, authenticated;
revoke all on function close_survey(uuid)                     from public, anon, authenticated;
revoke all on function get_public_survey(text)                from public, anon, authenticated;
revoke all on function submit_survey_response(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function get_survey_results(uuid)               from public, anon, authenticated;

-- Student functions: anon (and signed-in instructors, so they can preview).
grant execute on function get_public_survey(text)                to anon, authenticated;
grant execute on function submit_survey_response(uuid, text, jsonb) to anon, authenticated;

-- Instructor functions: authenticated only. activate_survey runs as the
-- caller, so the caller also needs the slug helper.
grant execute on function generate_public_slug()   to authenticated;
grant execute on function activate_survey(uuid)    to authenticated;
grant execute on function close_survey(uuid)       to authenticated;
grant execute on function get_survey_results(uuid) to authenticated;
