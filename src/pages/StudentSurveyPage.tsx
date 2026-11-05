import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { errorCode, friendlyError } from '../lib/errors'
import { getPublicSurvey, submitResponse } from '../lib/surveys'
import { getAnonymousToken, hasSubmitted, markSubmitted } from '../lib/token'
import type { Question } from '../lib/types'

type View =
  | { kind: 'loading' }
  | { kind: 'not_found' }
  | { kind: 'closed' }
  | { kind: 'already' }
  | { kind: 'success' }
  | { kind: 'load_error'; message: string }
  | {
      kind: 'form'
      surveyId: string
      title: string
      description: string | null
      questions: Question[]
    }

/** Student page (UI.md §7–8): no login, no menu, one column, big targets. */
export function StudentSurveyPage() {
  const { slug = '' } = useParams()
  const [view, setView] = useState<View>({ kind: 'loading' })
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [missing, setMissing] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const errorRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    let cancelled = false
    setView({ kind: 'loading' })
    getPublicSurvey(slug)
      .then((r) => {
        if (cancelled) return
        if (r.status === 'not_found') setView({ kind: 'not_found' })
        else if (r.status === 'closed') setView({ kind: 'closed' })
        else if (hasSubmitted(r.survey.id)) setView({ kind: 'already' })
        else {
          document.title = r.survey.title
          setView({
            kind: 'form',
            surveyId: r.survey.id,
            title: r.survey.title,
            description: r.survey.description,
            questions: r.questions,
          })
        }
      })
      .catch((e) => !cancelled && setView({ kind: 'load_error', message: friendlyError(e) }))
    return () => {
      cancelled = true
    }
  }, [slug])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (view.kind !== 'form' || submitting) return
    const unanswered = view.questions.filter((q) => !answers[q.id]).map((q) => q.id)
    setMissing(new Set(unanswered))
    if (unanswered.length) {
      setSubmitError(
        `Please answer ${unanswered.length === 1 ? 'the highlighted question' : `all ${unanswered.length} highlighted questions`}.`,
      )
      document.getElementById(`q-${unanswered[0]}`)?.scrollIntoView({ block: 'center' })
      document.querySelector<HTMLInputElement>(`input[name="q-${unanswered[0]}"]`)?.focus()
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      await submitResponse(
        view.surveyId,
        getAnonymousToken(),
        view.questions.map((q) => ({ question_id: q.id, choice_id: answers[q.id] })),
      )
      markSubmitted(view.surveyId)
      setView({ kind: 'success' })
    } catch (err) {
      const code = errorCode(err)
      if (code === 'DUPLICATE_RESPONSE') {
        markSubmitted(view.surveyId)
        setView({ kind: 'already' })
      } else if (code === 'SURVEY_NOT_ACTIVE') setView({ kind: 'closed' })
      else {
        setSubmitError(friendlyError(err))
        requestAnimationFrame(() => errorRef.current?.focus())
      }
    } finally {
      setSubmitting(false)
    }
  }

  const shell = (children: React.ReactNode) => (
    <main className="mx-auto min-h-screen max-w-xl bg-white px-4 py-8 text-slate-950">
      {children}
    </main>
  )
  const message = (title: string, body?: string) =>
    shell(
      <div className="pt-16 text-center" role="status">
        <h1 className="text-3xl font-bold">{title}</h1>
        {body && <p className="mt-4 text-lg text-slate-800">{body}</p>}
      </div>,
    )

  switch (view.kind) {
    case 'loading':
      return message('Loading survey...')
    case 'not_found':
      return message('Survey not found.', 'Check the link or scan the QR code again.')
    case 'closed':
      return message('This survey is no longer accepting responses.')
    case 'already':
      return message('You have already submitted a response to this survey.')
    case 'success':
      return message('Thank you!', 'Your response has been recorded.')
    case 'load_error':
      return message('Could not load the survey.', view.message)
  }

  return shell(
    <form onSubmit={onSubmit} noValidate>
      <h1 className="text-2xl font-bold sm:text-3xl">{view.title}</h1>
      {view.description && <p className="mt-2 text-lg text-slate-800">{view.description}</p>}
      <ol className="mt-6 space-y-8">
        {view.questions.map((q, i) => {
          const isMissing = missing.has(q.id) && !answers[q.id]
          return (
            <li key={q.id} id={`q-${q.id}`}>
              <fieldset
                aria-invalid={isMissing}
                aria-describedby={isMissing ? `q-${q.id}-err` : undefined}
              >
                <legend className="text-lg font-semibold sm:text-xl">
                  {i + 1}. {q.question_text}
                </legend>
                {isMissing && (
                  <p id={`q-${q.id}-err`} className="mt-1 font-medium text-red-800">
                    Please choose an answer.
                  </p>
                )}
                <div className="mt-3 space-y-3">
                  {q.choices.map((c) => {
                    const checked = answers[q.id] === c.id
                    return (
                      <label
                        key={c.id}
                        className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border-2 px-4 py-3 text-lg has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue-600 ${
                          checked
                            ? 'border-blue-700 bg-blue-50'
                            : isMissing
                              ? 'border-red-700'
                              : 'border-slate-500'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          value={c.id}
                          checked={checked}
                          onChange={() => setAnswers((a) => ({ ...a, [q.id]: c.id }))}
                          className="h-6 w-6 shrink-0 accent-blue-700"
                        />
                        <span>{c.choice_text}</span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>
            </li>
          )
        })}
      </ol>
      {submitError && (
        <p
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="mt-6 rounded-lg border border-red-700 bg-red-50 p-3 font-medium text-red-900"
        >
          {submitError}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="mt-8 min-h-14 w-full rounded-lg bg-blue-700 px-4 text-xl font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
      >
        {submitting ? 'Submitting...' : 'Submit'}
      </button>
    </form>,
  )
}
