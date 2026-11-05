-- Plain-SQL tests for 001-003. Run with: npm run test:db   (needs Docker)
\set ON_ERROR_STOP 1
create temp table results(name text, ok boolean);
grant all on results to anon, authenticated;

create or replace function pg_temp.expect_error(sql text, code text) returns boolean
language plpgsql as $$
begin
  execute sql;
  return false;
exception when others then
  if sqlerrm <> code then raise notice 'expected % got %', code, sqlerrm; end if;
  return sqlerrm = code;
end $$;
grant execute on function pg_temp.expect_error(text, text) to anon, authenticated;

-- ---------- instructor setup ----------
set role authenticated;
select save_survey('{"title":"Recursion","questions":[
  {"question_text":"Base case?","question_type":"multiple_choice","choices":[{"choice_text":"A"},{"choice_text":"B"}]},
  {"question_text":"Stops?","question_type":"true_false"}]}') as s1 \gset
select save_survey('{"title":"Pointers","questions":[
  {"question_text":"Q","question_type":"true_false"}]}') as s2 \gset
insert into results select 'tf creates True/False',
  (select array_agg(c.choice_text order by c.position) from choices c join questions q on q.id=c.question_id
   where q.survey_id=:'s2') = '{True,False}';
insert into results select 'validation: duplicate choices rejected', pg_temp.expect_error(
  $q$select save_survey('{"title":"x","questions":[{"question_text":"q","question_type":"multiple_choice","choices":[{"choice_text":"a"},{"choice_text":"A"}]}]}')$q$,
  'VALIDATION_ERROR');
select activate_survey(:'s1')->>'public_slug' as slug1 \gset
insert into results select 'slug is 6 chars', length(:'slug1') = 6;
select activate_survey(:'s2') is not null;
insert into results select 'only one active (s1 auto-closed)',
  (select status from surveys where id=:'s1')='closed' and (select count(*) from surveys where status='active')=1;
select activate_survey(:'s1') is not null;  -- reopen s1
insert into results select 'reopen keeps slug', (select public_slug from surveys where id=:'s1') = :'slug1';
select q.id as q1, c.id as c1 from questions q join choices c on c.question_id=q.id
  where q.survey_id=:'s1' and q.position=1 and c.position=1 \gset
select q.id as q2, c.id as c2 from questions q join choices c on c.question_id=q.id
  where q.survey_id=:'s1' and q.position=2 and c.position=1 \gset
select q.id as qx, c.id as cx from questions q join choices c on c.question_id=q.id
  where q.survey_id=:'s2' limit 1 \gset
reset role;

-- ---------- anon ----------
set role anon;
insert into results select 'anon sees active survey', (select count(*) from surveys where id=:'s1')=1;
insert into results select 'anon cannot see closed survey', (select count(*) from surveys where id=:'s2')=0;
insert into results select 'anon cannot read responses', pg_temp.expect_error('select * from responses', 'permission denied for table responses');
insert into results select 'anon cannot insert response', pg_temp.expect_error(
  format('insert into responses(survey_id, anonymous_token) values (%L,%L)', :'s1', 'x'), 'permission denied for table responses');
insert into results select 'anon cannot update surveys', pg_temp.expect_error(
  'update surveys set title = ''hacked''', 'permission denied for table surveys');
insert into results select 'anon cannot call activate', pg_temp.expect_error(
  format('select activate_survey(%L)', :'s2'), 'permission denied for function activate_survey');
insert into results select 'public: active', get_public_survey(:'slug1')->>'status'='active'
  and jsonb_array_length(get_public_survey(:'slug1')->'questions')=2;
insert into results select 'public: not found', get_public_survey('nope00')->>'status'='not_found';
insert into results select 'submit: missing answer', pg_temp.expect_error(
  format('select submit_survey_response(%L,%L,%L)', :'s1', 't1', jsonb_build_array(jsonb_build_object('question_id',:'q1','choice_id',:'c1'))),
  'MISSING_REQUIRED_ANSWER');
insert into results select 'submit: choice from other question', pg_temp.expect_error(
  format('select submit_survey_response(%L,%L,%L)', :'s1', 't1', jsonb_build_array(
    jsonb_build_object('question_id',:'q1','choice_id',:'c2'), jsonb_build_object('question_id',:'q2','choice_id',:'c2'))),
  'INVALID_CHOICE');
insert into results select 'submit: question from other survey', pg_temp.expect_error(
  format('select submit_survey_response(%L,%L,%L)', :'s1', 't1', jsonb_build_array(jsonb_build_object('question_id',:'qx','choice_id',:'cx'))),
  'INVALID_QUESTION');
insert into results select 'submit: bad uuid', pg_temp.expect_error(
  format('select submit_survey_response(%L,%L,%L)', :'s1', 't1', '[{"question_id":"zzz","choice_id":"zzz"}]'), 'INVALID_QUESTION');
insert into results select 'submit: ok', (submit_survey_response(:'s1', 't1', jsonb_build_array(
    jsonb_build_object('question_id',:'q1','choice_id',:'c1'), jsonb_build_object('question_id',:'q2','choice_id',:'c2')))->>'success')::boolean;
insert into results select 'submit: duplicate', pg_temp.expect_error(
  format('select submit_survey_response(%L,%L,%L)', :'s1', 't1', jsonb_build_array(
    jsonb_build_object('question_id',:'q1','choice_id',:'c1'), jsonb_build_object('question_id',:'q2','choice_id',:'c2'))),
  'DUPLICATE_RESPONSE');
reset role;

-- ---------- instructor: results, locks, close ----------
set role authenticated;
insert into results select 'results counts', (
  select (q->>'response_count')::int = 1 and ((q->'choices'->0)->>'percentage')::numeric = 100
  from jsonb_array_elements(get_survey_results(:'s1')->'questions') q limit 1);
insert into results select 'edit locked while active', pg_temp.expect_error(
  format('delete from questions where survey_id=%L', :'s1'), 'SURVEY_ACTIVE');
insert into results select 'cannot delete active survey', pg_temp.expect_error(
  format('delete from surveys where id=%L', :'s1'), 'SURVEY_ACTIVE');
select close_survey(:'s1') is not null;
insert into results select 'edit locked once responses exist', pg_temp.expect_error(
  format('select save_survey(%L)', jsonb_build_object('id',:'s1','title','x','questions',
     jsonb_build_array(jsonb_build_object('question_text','q','question_type','true_false')))), 'SURVEY_HAS_RESPONSES');
insert into results select 'title-only edit allowed after responses',
  save_survey(jsonb_build_object('id',:'s1','title','Recursion v2','questions',null)) = :'s1';
update surveys set status='archived' where id=:'s1';
insert into results select 'closed -> archived allowed', (select status from surveys where id=:'s1')='archived';
insert into results select 'archived -> active rejected', pg_temp.expect_error(
  format('select activate_survey(%L)', :'s1'), 'INVALID_STATUS_TRANSITION');
select duplicate_survey(:'s1') as s3 \gset
insert into results select 'duplicate: draft, copy name, no responses, no slug', (
  select status='draft' and title='Copy of Recursion v2' and public_slug is null from surveys where id=:'s3')
  and (select count(*) from questions where survey_id=:'s3')=2
  and (select count(*) from responses where survey_id=:'s3')=0;
reset role;

set role anon;
insert into results select 'submit to closed rejected', pg_temp.expect_error(
  format('select submit_survey_response(%L,%L,%L)', :'s1', 't2', '[]'), 'SURVEY_NOT_ACTIVE');
insert into results select 'public: closed', get_public_survey(:'slug1')->>'status'='closed';
reset role;

set role authenticated;
delete from surveys where id=:'s1';
insert into results select 'delete cascades', (select count(*) from responses where survey_id=:'s1')=0;
reset role;

select case when ok then 'PASS' else 'FAIL' end as result, name from results;
select count(*) filter (where not ok) as failures from results \gset
\if :failures
  \echo FAILURES: :failures
  select 1/0;
\endif
