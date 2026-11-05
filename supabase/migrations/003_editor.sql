-- =============================================================================
-- 003_editor.sql — editor, duplicate, and lifecycle guards (Phases 4, 5, 12).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Status transition guard (DECISIONS.md D6). Allowed:
--   draft    -> active | archived
--   active   -> closed
--   closed   -> active | archived
--   archived -> closed
-- An active survey also cannot be deleted; close it first.
-- -----------------------------------------------------------------------------
create or replace function guard_survey_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    if tg_op = 'DELETE' then
        if old.status = 'active' then
            raise exception 'SURVEY_ACTIVE';
        end if;
        return old;
    end if;

    if new.status is distinct from old.status and not (
           (old.status = 'draft'    and new.status in ('active', 'archived'))
        or (old.status = 'active'   and new.status = 'closed')
        or (old.status = 'closed'   and new.status in ('active', 'archived'))
        or (old.status = 'archived' and new.status = 'closed')
    ) then
        raise exception 'INVALID_STATUS_TRANSITION';
    end if;

    -- Only activate_survey assigns a slug, and a slug never changes.
    if old.public_slug is not null and new.public_slug is distinct from old.public_slug then
        raise exception 'INVALID_REQUEST';
    end if;
    return new;
end;
$$;

create trigger surveys_guard_status
before update or delete on surveys
for each row execute function guard_survey_status();

-- -----------------------------------------------------------------------------
-- Content lock (DECISIONS.md D7): questions and choices cannot change while
-- the survey is active, or once it has any responses. This protects past
-- results. Deleting the whole survey still works: a cascade delete from
-- surveys fires these triggers too, so they skip when the parent survey row
-- is already gone.
-- -----------------------------------------------------------------------------
create or replace function guard_survey_content()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    v_survey_id uuid;
    v_status text;
begin
    if tg_table_name = 'questions' then
        v_survey_id := coalesce(new.survey_id, old.survey_id);
    else
        select q.survey_id into v_survey_id
        from questions q where q.id = coalesce(new.question_id, old.question_id);
        if v_survey_id is null then
            return coalesce(new, old);            -- parent question already deleted
        end if;
    end if;

    select status into v_status from surveys where id = v_survey_id;
    if not found then
        return coalesce(new, old);                -- parent survey being deleted
    end if;
    if v_status = 'active' then
        raise exception 'SURVEY_ACTIVE';
    end if;
    if exists (select 1 from responses where survey_id = v_survey_id) then
        raise exception 'SURVEY_HAS_RESPONSES';
    end if;
    return coalesce(new, old);
end;
$$;

create trigger questions_guard_content
before insert or update or delete on questions
for each row execute function guard_survey_content();

create trigger choices_guard_content
before insert or update or delete on choices
for each row execute function guard_survey_content();

-- -----------------------------------------------------------------------------
-- save_survey(p_survey jsonb) -> uuid. Instructor only.
-- Creates (no "id") or updates a survey and replaces all of its questions and
-- choices in one transaction (DECISIONS.md D18). Positions become 1..n in
-- array order.
--   {"id": uuid|null, "title": "...", "description": "...",
--    "questions": [{"question_text": "...", "question_type": "multiple_choice",
--                   "choices": [{"choice_text": "..."}]}] | null}
-- "questions": null means "change title/description only". That is the only
-- edit allowed once a survey has responses.
-- Validation (D19) raises VALIDATION_ERROR. The UI shows detailed messages
-- before it ever calls this function.
-- -----------------------------------------------------------------------------
create or replace function save_survey(p_survey jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_id uuid := nullif(p_survey->>'id', '')::uuid;
    v_title text := trim(coalesce(p_survey->>'title', ''));
    v_description text := nullif(trim(coalesce(p_survey->>'description', '')), '');
    v_questions jsonb := p_survey->'questions';
    v_q jsonb;
    v_c jsonb;
    v_qpos int := 0;
    v_cpos int;
    v_question_id uuid;
    v_type text;
    v_texts text[];
begin
    if length(v_title) = 0 or length(v_title) > 200 then
        raise exception 'VALIDATION_ERROR';
    end if;

    if v_questions is not null and jsonb_typeof(v_questions) = 'null' then
        v_questions := null;
    end if;

    if v_questions is not null then
        if jsonb_typeof(v_questions) <> 'array' or jsonb_array_length(v_questions) = 0 then
            raise exception 'VALIDATION_ERROR';
        end if;
        for v_q in select * from jsonb_array_elements(v_questions) loop
            v_type := v_q->>'question_type';
            if length(trim(coalesce(v_q->>'question_text', ''))) = 0
               or v_type not in ('multiple_choice', 'true_false') then
                raise exception 'VALIDATION_ERROR';
            end if;
            if v_type = 'multiple_choice' then
                select array_agg(lower(trim(coalesce(e->>'choice_text', ''))))
                into v_texts
                from jsonb_array_elements(coalesce(v_q->'choices', '[]'::jsonb)) e;
                if coalesce(array_length(v_texts, 1), 0) not between 2 and 10
                   or '' = any (v_texts)
                   or (select count(distinct t) from unnest(v_texts) t) <> array_length(v_texts, 1) then
                    raise exception 'VALIDATION_ERROR';
                end if;
            end if;
        end loop;
    end if;

    if v_id is null then
        if v_questions is null then
            raise exception 'VALIDATION_ERROR';
        end if;
        insert into surveys (title, description) values (v_title, v_description)
        returning id into v_id;
    else
        update surveys set title = v_title, description = v_description where id = v_id;
        if not found then
            raise exception 'SURVEY_NOT_FOUND';
        end if;
    end if;

    if v_questions is not null then
        -- The content-lock triggers raise SURVEY_ACTIVE / SURVEY_HAS_RESPONSES here.
        delete from questions where survey_id = v_id;

        for v_q in select * from jsonb_array_elements(v_questions) loop
            v_qpos := v_qpos + 1;
            v_type := v_q->>'question_type';
            insert into questions (survey_id, question_text, question_type, position)
            values (v_id, trim(v_q->>'question_text'), v_type, v_qpos)
            returning id into v_question_id;

            if v_type = 'true_false' then
                -- True/False choices are always exactly these two (D4).
                insert into choices (question_id, choice_text, position)
                values (v_question_id, 'True', 1), (v_question_id, 'False', 2);
            else
                v_cpos := 0;
                for v_c in select * from jsonb_array_elements(v_q->'choices') loop
                    v_cpos := v_cpos + 1;
                    insert into choices (question_id, choice_text, position)
                    values (v_question_id, trim(v_c->>'choice_text'), v_cpos);
                end loop;
            end if;
        end loop;
    end if;

    return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- duplicate_survey(p_survey_id) -> uuid. Instructor only. Phase 12 / D17.
-- Copies title ("Copy of ..."), description, questions and choices into a
-- new Draft with no slug. Responses are not copied.
-- -----------------------------------------------------------------------------
create or replace function duplicate_survey(p_survey_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_new_id uuid;
    v_q record;
    v_new_q uuid;
begin
    insert into surveys (title, description, status)
    select left('Copy of ' || title, 200), description, 'draft'
    from surveys where id = p_survey_id
    returning id into v_new_id;

    if v_new_id is null then
        raise exception 'SURVEY_NOT_FOUND';
    end if;

    for v_q in select * from questions where survey_id = p_survey_id order by position loop
        insert into questions (survey_id, question_text, question_type, position)
        values (v_new_id, v_q.question_text, v_q.question_type, v_q.position)
        returning id into v_new_q;

        insert into choices (question_id, choice_text, position)
        select v_new_q, choice_text, position from choices where question_id = v_q.id;
    end loop;

    return v_new_id;
end;
$$;

revoke all on function save_survey(jsonb)      from public, anon, authenticated;
revoke all on function duplicate_survey(uuid)  from public, anon, authenticated;
grant execute on function save_survey(jsonb)     to authenticated;
grant execute on function duplicate_survey(uuid) to authenticated;
