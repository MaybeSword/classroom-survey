/**
 * Proves the anon (student) permissions using ONLY the public anon key.
 *
 *   1. Run supabase/tests/rls_seed.sql in the Supabase SQL editor.
 *   2. node --env-file=.env scripts/rls-check.ts      (npm run rls-check)
 *   3. Run supabase/tests/rls_cleanup.sql.
 *
 * Prints PASS/FAIL per check and exits 1 if anything fails.
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !anonKey) {
  console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (e.g. in .env).')
  process.exit(2)
}
if (/service_role/.test(Buffer.from(anonKey.split('.')[1] ?? '', 'base64').toString())) {
  console.error('That is the service-role key. This script must run with the anon key only.')
  process.exit(2)
}

const db = createClient(url, anonKey, { auth: { persistSession: false } })

const ACTIVE = '11111111-1111-4111-8111-111111111111'
const DRAFT = '22222222-2222-4222-8222-222222222222'
const CLOSED = '33333333-3333-4333-8333-333333333333'
const ACTIVE_Q = '11111111-0000-4000-8000-000000000001'
const ACTIVE_TRUE = '11111111-0000-4000-8000-0000000000c1'
const CLOSED_Q = '33333333-0000-4000-8000-000000000001'
const CLOSED_TRUE = '33333333-0000-4000-8000-0000000000c1'

let failures = 0
function report(ok: boolean, name: string, detail = '') {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}

/** A blocked read is either an error or zero rows. */
async function readBlocked(table: string, filter?: [string, string]) {
  let q = db.from(table).select('*')
  if (filter) q = q.eq(filter[0], filter[1])
  const { data, error } = await q
  return {
    ok: Boolean(error) || (data?.length ?? 0) === 0,
    detail: error ? error.message : `${data?.length ?? 0} rows`,
  }
}

async function main() {
  // Precondition: the seed was run.
  const { data: pub } = await db.rpc('get_public_survey', { p_slug: 'rlsact' })
  if (pub?.status !== 'active') {
    console.error('Fixtures missing: run supabase/tests/rls_seed.sql first.')
    process.exit(2)
  }

  // 1. Active readable; draft and closed not.
  {
    const a = await db.from('surveys').select('id').eq('id', ACTIVE)
    const q = await db.from('questions').select('id').eq('survey_id', ACTIVE)
    report(
      !a.error && a.data?.length === 1 && q.data?.length === 1,
      '1a anon can read the active survey and its questions',
    )
    const d = await readBlocked('surveys', ['id', DRAFT])
    report(d.ok, '1b anon cannot read a draft survey', d.detail)
    const c = await readBlocked('surveys', ['id', CLOSED])
    const cq = await readBlocked('questions', ['survey_id', CLOSED])
    report(
      c.ok && cq.ok,
      '1c anon cannot read a closed survey or its questions',
      `${c.detail}; ${cq.detail}`,
    )
  }

  // 2. No reads of responses / answers / results.
  {
    const r = await readBlocked('responses')
    report(r.ok, '2a anon cannot read responses', r.detail)
    const a = await readBlocked('answers')
    report(a.ok, '2b anon cannot read answers', a.detail)
    const res = await db.rpc('get_survey_results', { p_survey_id: ACTIVE })
    report(
      Boolean(res.error),
      '2c anon cannot call get_survey_results',
      res.error?.message ?? 'returned data',
    )
  }

  // 3. No direct inserts.
  {
    const r = await db
      .from('responses')
      .insert({ survey_id: ACTIVE, anonymous_token: `direct-${Date.now()}` })
    report(
      Boolean(r.error),
      '3a anon cannot insert into responses',
      r.error?.message ?? 'insert succeeded',
    )
    const a = await db.from('answers').insert({
      response_id: '00000000-0000-4000-8000-000000000000',
      question_id: ACTIVE_Q,
      choice_id: ACTIVE_TRUE,
    })
    // A foreign-key error would mean the insert got past RLS, so require a permission error.
    report(
      Boolean(a.error) && a.error?.code !== '23503',
      '3b anon cannot insert into answers',
      a.error?.message ?? 'insert succeeded',
    )
  }

  // 4. No updates or deletes (and nothing changed).
  {
    const u = await db.from('surveys').update({ title: 'hacked' }).eq('id', ACTIVE).select()
    const d = await db.from('surveys').delete().eq('id', ACTIVE).select()
    const after = await db.from('surveys').select('title').eq('id', ACTIVE).single()
    const blockedU = Boolean(u.error) || (u.data?.length ?? 0) === 0
    const blockedD = Boolean(d.error) || (d.data?.length ?? 0) === 0
    report(
      blockedU && after.data?.title === 'RLS check: active',
      '4a anon cannot update surveys',
      u.error?.message ?? '0 rows',
    )
    report(
      blockedD && Boolean(after.data),
      '4b anon cannot delete surveys',
      d.error?.message ?? '0 rows',
    )
    const act = await db.rpc('activate_survey', { p_survey_id: DRAFT })
    report(
      Boolean(act.error),
      '4c anon cannot call activate_survey',
      act.error?.message ?? 'succeeded',
    )
  }

  // 5–7. Submissions through the RPC.
  const token = `rls-check-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const answers = [{ question_id: ACTIVE_Q, choice_id: ACTIVE_TRUE }]
  {
    const s = await db.rpc('submit_survey_response', {
      p_survey_id: ACTIVE,
      p_anonymous_token: token,
      p_answers: answers,
    })
    report(
      !s.error && s.data?.success === true,
      '5  anon can submit through submit_survey_response',
      s.error?.message ?? '',
    )
  }
  {
    const s = await db.rpc('submit_survey_response', {
      p_survey_id: ACTIVE,
      p_anonymous_token: token,
      p_answers: answers,
    })
    report(
      s.error?.message === 'DUPLICATE_RESPONSE',
      '6  duplicate submission is rejected',
      s.error?.message ?? 'accepted',
    )
  }
  {
    const s = await db.rpc('submit_survey_response', {
      p_survey_id: CLOSED,
      p_anonymous_token: `${token}-closed`,
      p_answers: [{ question_id: CLOSED_Q, choice_id: CLOSED_TRUE }],
    })
    report(
      s.error?.message === 'SURVEY_NOT_ACTIVE',
      '7  submission to a closed survey is rejected',
      s.error?.message ?? 'accepted',
    )
  }

  console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed')
  process.exit(failures ? 1 : 0)
}

main().catch((e) => {
  console.error('rls-check crashed:', e)
  process.exit(1)
})
