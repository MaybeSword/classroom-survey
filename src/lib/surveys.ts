import { supabase } from './supabase'
import type {
  PublicSurveyResult,
  Question,
  SurveyListItem,
  SurveyResults,
  SurveyStatus,
  SurveyWithQuestions,
} from './types'
import type { DraftSurvey } from './validation'
import { buildResultsCsv, csvFilename, downloadCsv } from './csv'

/** Throw the PostgREST error so callers can pass it to friendlyError(). */
function check<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw res.error
  return res.data
}

type Counted = { responses: { count: number }[] }

export async function listSurveys(): Promise<SurveyListItem[]> {
  const rows = check(
    await supabase
      .from('surveys')
      .select('*, responses(count)')
      .order('created_at', { ascending: false }),
  ) as (SurveyListItem & Counted)[]
  return rows.map(({ responses, ...s }) => ({ ...s, response_count: responses?.[0]?.count ?? 0 }))
}

export async function getSurvey(id: string): Promise<SurveyWithQuestions | null> {
  const row = check(
    await supabase
      .from('surveys')
      .select(
        '*, responses(count), questions(id, question_text, question_type, position, choices(id, choice_text, position))',
      )
      .eq('id', id)
      .maybeSingle(),
  ) as (SurveyWithQuestions & Counted) | null
  if (!row) return null
  const questions: Question[] = [...row.questions]
    .sort((a, b) => a.position - b.position)
    .map((q) => ({ ...q, choices: [...q.choices].sort((a, b) => a.position - b.position) }))
  const { responses, ...rest } = row
  return { ...rest, questions, response_count: responses?.[0]?.count ?? 0 }
}

export async function saveSurvey(
  id: string | null,
  draft: DraftSurvey,
  includeQuestions: boolean,
): Promise<string> {
  return check(
    await supabase.rpc('save_survey', {
      p_survey: {
        id,
        title: draft.title,
        description: draft.description,
        questions: includeQuestions
          ? draft.questions.map((q) => ({
              question_text: q.question_text,
              question_type: q.question_type,
              choices:
                q.question_type === 'true_false'
                  ? []
                  : q.choices.map((c) => ({ choice_text: c.choice_text })),
            }))
          : null,
      },
    }),
  ) as string
}

export async function activateSurvey(
  id: string,
): Promise<{ id: string; status: 'active'; public_slug: string }> {
  return check(await supabase.rpc('activate_survey', { p_survey_id: id }))
}

export async function closeSurvey(id: string): Promise<void> {
  check(await supabase.rpc('close_survey', { p_survey_id: id }))
}

export async function setStatus(
  id: string,
  status: Extract<SurveyStatus, 'archived' | 'closed'>,
): Promise<void> {
  check(await supabase.from('surveys').update({ status }).eq('id', id))
}

export async function deleteSurvey(id: string): Promise<void> {
  check(await supabase.from('surveys').delete().eq('id', id))
}

export async function duplicateSurvey(id: string): Promise<string> {
  return check(await supabase.rpc('duplicate_survey', { p_survey_id: id })) as string
}

export async function countResponses(surveyId: string): Promise<number> {
  const { count, error } = await supabase
    .from('responses')
    .select('id', { count: 'exact', head: true })
    .eq('survey_id', surveyId)
  if (error) throw error
  return count ?? 0
}

export async function getResults(surveyId: string): Promise<SurveyResults> {
  return check(await supabase.rpc('get_survey_results', { p_survey_id: surveyId })) as SurveyResults
}

export async function getPublicSurvey(slug: string): Promise<PublicSurveyResult> {
  return check(await supabase.rpc('get_public_survey', { p_slug: slug })) as PublicSurveyResult
}

export async function submitResponse(
  surveyId: string,
  token: string,
  answers: { question_id: string; choice_id: string }[],
): Promise<string> {
  const res = check(
    await supabase.rpc('submit_survey_response', {
      p_survey_id: surveyId,
      p_anonymous_token: token,
      p_answers: answers,
    }),
  ) as { response_id: string }
  return res.response_id
}

/** Fetches everything for one survey and downloads the CSV (Phase 11). */
export async function exportSurveyCsv(surveyId: string): Promise<void> {
  const survey = await getSurvey(surveyId)
  if (!survey) throw { message: 'SURVEY_NOT_FOUND' }
  const responses: {
    id: string
    submitted_at: string
    answers: { question_id: string; choice_id: string | null }[]
  }[] = []
  // PostgREST caps a page at 1000 rows, so read in pages.
  const page = 1000
  for (let from = 0; ; from += page) {
    const rows = check(
      await supabase
        .from('responses')
        .select('id, submitted_at, answers(question_id, choice_id)')
        .eq('survey_id', surveyId)
        .order('submitted_at')
        .range(from, from + page - 1),
    ) as typeof responses
    responses.push(...rows)
    if (rows.length < page) break
  }
  const now = new Date()
  downloadCsv(
    csvFilename(survey.title, now),
    buildResultsCsv({ survey, questions: survey.questions, responses, exportedAt: now }),
  )
}
