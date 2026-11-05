import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { StatusBadge } from '../components/StatusBadge'
import { ConfirmDialog, type ConfirmOptions } from '../components/ConfirmDialog'
import { ErrorState, LoadingState } from '../components/States'
import { btn, fieldError, input, label } from '../components/ui'
import { friendlyError } from '../lib/errors'
import { newKey } from '../lib/format'
import { activateSurvey, duplicateSurvey, getSurvey, saveSurvey } from '../lib/surveys'
import type { QuestionType, SurveyWithQuestions } from '../lib/types'
import {
  LIMITS,
  validateSurvey,
  type DraftChoice,
  type DraftQuestion,
  type DraftSurvey,
  type ValidationErrors,
} from '../lib/validation'

const emptyChoice = (): DraftChoice => ({ key: newKey(), choice_text: '' })
const emptyQuestion = (): DraftQuestion => ({
  key: newKey(),
  question_text: '',
  question_type: 'multiple_choice',
  choices: [emptyChoice(), emptyChoice()],
})

function toDraft(s: SurveyWithQuestions): DraftSurvey {
  return {
    title: s.title,
    description: s.description ?? '',
    questions: s.questions.map((q) => ({
      key: newKey(),
      question_text: q.question_text,
      question_type: q.question_type,
      choices: q.choices.map((c) => ({ key: newKey(), choice_text: c.choice_text })),
    })),
  }
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export function SurveyEditorPage() {
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()

  const [loaded, setLoaded] = useState<SurveyWithQuestions | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [draft, setDraft] = useState<DraftSurvey>(() => ({
    title: '',
    description: '',
    questions: [emptyQuestion()],
  }))
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<ConfirmOptions | null>(null)
  const [showErrors, setShowErrors] = useState(false)
  const errorSummary = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isNew) {
      document.title = 'New Survey · Classroom Survey'
      return
    }
    let cancelled = false
    setLoaded(null)
    setLoadError(null)
    getSurvey(id)
      .then((s) => {
        if (cancelled) return
        if (!s) setLoadError('Survey not found.')
        else {
          setLoaded(s)
          setDraft(toDraft(s))
        }
      })
      .catch((e) => !cancelled && setLoadError(friendlyError(e)))
    return () => {
      cancelled = true
    }
  }, [id, isNew])

  // Re-validate live once the user has tried to save, so errors clear as they fix them.
  useEffect(() => {
    if (showErrors) setErrors(validateSurvey(draft))
  }, [draft, showErrors])

  const locked = loaded?.status === 'active'
  const questionsLocked = Boolean(
    loaded && (loaded.response_count > 0 || loaded.status === 'archived'),
  )

  function update(patch: Partial<DraftSurvey>) {
    setDraft((d) => ({ ...d, ...patch }))
    setSaveState('idle')
  }
  function updateQuestion(key: string, patch: Partial<DraftQuestion>) {
    setDraft((d) => ({
      ...d,
      questions: d.questions.map((q) => (q.key === key ? { ...q, ...patch } : q)),
    }))
    setSaveState('idle')
  }
  function updateChoices(qKey: string, fn: (c: DraftChoice[]) => DraftChoice[]) {
    setDraft((d) => ({
      ...d,
      questions: d.questions.map((q) => (q.key === qKey ? { ...q, choices: fn(q.choices) } : q)),
    }))
    setSaveState('idle')
  }
  function changeType(q: DraftQuestion, type: QuestionType) {
    // Keep typed choices in case the user switches back to multiple choice.
    updateQuestion(q.key, {
      question_type: type,
      choices:
        type === 'multiple_choice' && q.choices.length === 0
          ? [emptyChoice(), emptyChoice()]
          : q.choices,
    })
  }

  async function save(): Promise<string | null> {
    setShowErrors(true)
    const all = validateSurvey(draft)
    // When questions are locked, only the title can be wrong.
    const v: ValidationErrors = questionsLocked ? (all.title ? { title: all.title } : {}) : all
    setErrors(v)
    if (Object.keys(v).length > 0) {
      setSaveError('Fix the highlighted fields before saving.')
      requestAnimationFrame(() => errorSummary.current?.focus())
      return null
    }
    setSaveState('saving')
    setSaveError(null)
    try {
      const savedId = await saveSurvey(id ?? null, draft, !questionsLocked)
      setSaveState('saved')
      if (isNew) navigate(`/surveys/${savedId}/edit`, { replace: true })
      return savedId
    } catch (e) {
      setSaveState('idle')
      setSaveError(friendlyError(e))
      return null
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    await save()
  }

  async function saveAndActivate() {
    const savedId = await save()
    if (!savedId) return
    try {
      await activateSurvey(savedId)
      navigate(`/surveys/${savedId}/present`)
    } catch (e) {
      setSaveError(friendlyError(e))
    }
  }

  function askDeleteQuestion(q: DraftQuestion, index: number) {
    const empty = !q.question_text.trim() && q.choices.every((c) => !c.choice_text.trim())
    const remove = () => update({ questions: draft.questions.filter((x) => x.key !== q.key) })
    if (empty) return remove()
    setConfirm({
      title: `Delete question ${index + 1}?`,
      body: (
        <p>
          "{q.question_text || 'Untitled question'}" and its choices will be removed from this
          draft.
        </p>
      ),
      confirmLabel: 'Delete question',
      danger: true,
      onConfirm: remove,
    })
  }

  async function duplicateToEdit() {
    if (!id) return
    try {
      const newId = await duplicateSurvey(id)
      navigate(`/surveys/${newId}/edit`)
    } catch (e) {
      setSaveError(friendlyError(e))
    }
  }

  const title = isNew ? 'New Survey' : 'Edit Survey'

  if (loadError)
    return (
      <PageShell title={title}>
        <ErrorState message={loadError}>
          <Link to="/dashboard" className={btn.secondary}>
            Back to Dashboard
          </Link>
        </ErrorState>
      </PageShell>
    )
  if (!isNew && !loaded)
    return (
      <PageShell title={title}>
        <LoadingState label="Loading survey..." />
      </PageShell>
    )

  if (locked)
    return (
      <PageShell title={title}>
        <ErrorState
          message={`"${loaded?.title}" is active, so it cannot be edited. Close it from the dashboard or the Present page first.`}
        >
          <div className="flex flex-wrap gap-2">
            <Link to={`/surveys/${id}/present`} className={btn.secondary}>
              Go to Present page
            </Link>
            <Link to="/dashboard" className={btn.secondary}>
              Back to Dashboard
            </Link>
          </div>
        </ErrorState>
      </PageShell>
    )

  const errorCount = Object.keys(errors).length

  return (
    <PageShell title={title} actions={loaded && <StatusBadge status={loaded.status} />}>
      <form onSubmit={onSubmit} noValidate className="space-y-6">
        {showErrors && errorCount > 0 && (
          <div
            ref={errorSummary}
            tabIndex={-1}
            role="alert"
            className="rounded-lg border border-red-700 bg-red-50 p-4 text-red-900"
          >
            <p className="font-semibold">
              {errorCount} field{errorCount === 1 ? ' needs' : 's need'} attention. Errors are shown
              next to each field.
            </p>
          </div>
        )}

        {questionsLocked && (
          <div className="rounded-lg border border-amber-800 bg-amber-50 p-4 text-amber-900">
            <p>
              This survey has {loaded?.response_count} response
              {loaded?.response_count === 1 ? '' : 's'}, so its questions are locked to protect past
              results. You can still change the title and description.
            </p>
            <button type="button" className={`${btn.secondary} mt-3`} onClick={duplicateToEdit}>
              Duplicate to edit questions
            </button>
          </div>
        )}

        <section className="space-y-4 rounded-lg border border-slate-300 bg-white p-4">
          <div>
            <label htmlFor="title" className={label}>
              Survey Title <span aria-hidden="true">*</span>
            </label>
            <input
              id="title"
              className={input}
              value={draft.title}
              maxLength={LIMITS.titleMax + 20}
              required
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? 'title-error' : undefined}
              onChange={(e) => update({ title: e.target.value })}
            />
            {errors.title && (
              <p id="title-error" className={fieldError}>
                {errors.title}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="description" className={label}>
              Description <span className="font-normal text-slate-700">(optional)</span>
            </label>
            <textarea
              id="description"
              rows={2}
              className={input}
              value={draft.description}
              onChange={(e) => update({ description: e.target.value })}
            />
          </div>
        </section>

        {questionsLocked ? (
          <ol className="space-y-3">
            {loaded?.questions.map((q, i) => (
              <li key={q.id} className="rounded-lg border border-slate-300 bg-white p-4">
                <p className="font-semibold">
                  {i + 1}. {q.question_text}
                </p>
                <ul className="mt-2 list-disc pl-6 text-slate-800">
                  {q.choices.map((c) => (
                    <li key={c.id}>{c.choice_text}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        ) : (
          <>
            <ol className="space-y-4" aria-label="Questions">
              {draft.questions.map((q, qi) => {
                const textErr = errors[`q:${q.key}:text`]
                const choicesErr = errors[`q:${q.key}:choices`]
                return (
                  <li key={q.key} className="rounded-lg border border-slate-300 bg-white p-4">
                    <fieldset>
                      <legend className="text-lg font-semibold">Question {qi + 1}</legend>
                      <div className="mt-3">
                        <label htmlFor={`qtext-${q.key}`} className={label}>
                          Question text <span aria-hidden="true">*</span>
                        </label>
                        <input
                          id={`qtext-${q.key}`}
                          className={input}
                          value={q.question_text}
                          aria-invalid={Boolean(textErr)}
                          aria-describedby={textErr ? `qtext-${q.key}-error` : undefined}
                          onChange={(e) => updateQuestion(q.key, { question_text: e.target.value })}
                        />
                        {textErr && (
                          <p id={`qtext-${q.key}-error`} className={fieldError}>
                            {textErr}
                          </p>
                        )}
                      </div>
                      <div className="mt-3 max-w-xs">
                        <label htmlFor={`qtype-${q.key}`} className={label}>
                          Type
                        </label>
                        <select
                          id={`qtype-${q.key}`}
                          className={input}
                          value={q.question_type}
                          onChange={(e) => changeType(q, e.target.value as QuestionType)}
                        >
                          <option value="multiple_choice">Multiple Choice</option>
                          <option value="true_false">True / False</option>
                        </select>
                      </div>

                      <div className="mt-4">
                        <p className={label} id={`choices-${q.key}`}>
                          Choices
                        </p>
                        {q.question_type === 'true_false' ? (
                          <p className="mt-1 text-slate-700">
                            True and False are added automatically.
                          </p>
                        ) : (
                          <>
                            <ul className="mt-2 space-y-2" aria-labelledby={`choices-${q.key}`}>
                              {q.choices.map((c, ci) => {
                                const cErr = errors[`c:${c.key}`]
                                return (
                                  <li key={c.key}>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <label htmlFor={`c-${c.key}`} className="sr-only">
                                        Question {qi + 1}, choice {ci + 1}
                                      </label>
                                      <input
                                        id={`c-${c.key}`}
                                        className={`${input} mt-0 min-w-0 flex-1`}
                                        value={c.choice_text}
                                        placeholder={`Choice ${ci + 1}`}
                                        aria-invalid={Boolean(cErr)}
                                        aria-describedby={cErr ? `c-${c.key}-error` : undefined}
                                        onChange={(e) =>
                                          updateChoices(q.key, (cs) =>
                                            cs.map((x) =>
                                              x.key === c.key
                                                ? { ...x, choice_text: e.target.value }
                                                : x,
                                            ),
                                          )
                                        }
                                      />
                                      <button
                                        type="button"
                                        className={btn.small}
                                        disabled={ci === 0}
                                        aria-label={`Move choice ${ci + 1} up`}
                                        onClick={() =>
                                          updateChoices(q.key, (cs) => move(cs, ci, ci - 1))
                                        }
                                      >
                                        ↑
                                      </button>
                                      <button
                                        type="button"
                                        className={btn.small}
                                        disabled={ci === q.choices.length - 1}
                                        aria-label={`Move choice ${ci + 1} down`}
                                        onClick={() =>
                                          updateChoices(q.key, (cs) => move(cs, ci, ci + 1))
                                        }
                                      >
                                        ↓
                                      </button>
                                      <button
                                        type="button"
                                        className={btn.smallDanger}
                                        aria-label={`Delete choice ${ci + 1}`}
                                        onClick={() =>
                                          updateChoices(q.key, (cs) =>
                                            cs.filter((x) => x.key !== c.key),
                                          )
                                        }
                                      >
                                        Delete
                                      </button>
                                    </div>
                                    {cErr && (
                                      <p id={`c-${c.key}-error`} className={fieldError}>
                                        {cErr}
                                      </p>
                                    )}
                                  </li>
                                )
                              })}
                            </ul>
                            {choicesErr && <p className={fieldError}>{choicesErr}</p>}
                            <button
                              type="button"
                              className={`${btn.small} mt-3`}
                              disabled={q.choices.length >= LIMITS.maxChoices}
                              onClick={() => updateChoices(q.key, (cs) => [...cs, emptyChoice()])}
                            >
                              + Add Choice
                            </button>
                          </>
                        )}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-4">
                        <button
                          type="button"
                          className={btn.small}
                          disabled={qi === 0}
                          onClick={() => update({ questions: move(draft.questions, qi, qi - 1) })}
                          aria-label={`Move question ${qi + 1} up`}
                        >
                          ↑ Move up
                        </button>
                        <button
                          type="button"
                          className={btn.small}
                          disabled={qi === draft.questions.length - 1}
                          onClick={() => update({ questions: move(draft.questions, qi, qi + 1) })}
                          aria-label={`Move question ${qi + 1} down`}
                        >
                          ↓ Move down
                        </button>
                        <button
                          type="button"
                          className={btn.smallDanger}
                          onClick={() => askDeleteQuestion(q, qi)}
                        >
                          Delete Question
                        </button>
                      </div>
                    </fieldset>
                  </li>
                )
              })}
            </ol>
            {errors.questions && <p className={fieldError}>{errors.questions}</p>}
            <button
              type="button"
              className={btn.secondary}
              onClick={() => update({ questions: [...draft.questions, emptyQuestion()] })}
            >
              + Add Question
            </button>
          </>
        )}

        {saveError && <ErrorState message={saveError} />}

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-300 pt-6">
          <button type="submit" className={btn.primary} disabled={saveState === 'saving'}>
            {saveState === 'saving' ? 'Saving...' : 'Save Draft'}
          </button>
          {(isNew || loaded?.status === 'draft' || loaded?.status === 'closed') && (
            <button
              type="button"
              className={btn.secondary}
              disabled={saveState === 'saving'}
              onClick={saveAndActivate}
            >
              Save and Activate
            </button>
          )}
          <Link to="/dashboard" className={btn.secondary}>
            Back to Dashboard
          </Link>
          <span role="status" className="text-slate-700">
            {saveState === 'saved' ? 'Saved' : ''}
          </span>
        </div>
      </form>
      <ConfirmDialog options={confirm} onClose={() => setConfirm(null)} />
    </PageShell>
  )
}
