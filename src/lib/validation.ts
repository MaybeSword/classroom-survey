import type { QuestionType } from './types'

/** Editor draft shape. `key` is a stable client-side id so reordering never loses edits. */
export interface DraftChoice {
  key: string
  choice_text: string
}
export interface DraftQuestion {
  key: string
  question_text: string
  question_type: QuestionType
  choices: DraftChoice[]
}
export interface DraftSurvey {
  title: string
  description: string
  questions: DraftQuestion[]
}

/** Errors keyed by field path: "title", "questions", "q:<key>:text", "q:<key>:choices", "c:<key>". */
export type ValidationErrors = Record<string, string>

export const LIMITS = { titleMax: 200, minChoices: 2, maxChoices: 10 } as const

/** Rules from DECISIONS.md D19 (the database checks the same ones). */
export function validateSurvey(s: DraftSurvey): ValidationErrors {
  const errors: ValidationErrors = {}
  const title = s.title.trim()
  if (!title) errors.title = 'Enter a survey title.'
  else if (title.length > LIMITS.titleMax)
    errors.title = `Keep the title under ${LIMITS.titleMax} characters.`

  if (s.questions.length === 0) errors.questions = 'Add at least one question.'

  for (const q of s.questions) {
    if (!q.question_text.trim()) errors[`q:${q.key}:text`] = 'Enter the question text.'
    if (q.question_type !== 'multiple_choice') continue
    if (q.choices.length < LIMITS.minChoices)
      errors[`q:${q.key}:choices`] = `Add at least ${LIMITS.minChoices} choices.`
    else if (q.choices.length > LIMITS.maxChoices)
      errors[`q:${q.key}:choices`] = `Use at most ${LIMITS.maxChoices} choices.`
    const seen = new Set<string>()
    for (const c of q.choices) {
      const t = c.choice_text.trim().toLowerCase()
      if (!t) errors[`c:${c.key}`] = 'Enter the choice text.'
      else if (seen.has(t)) errors[`c:${c.key}`] = 'This choice is a duplicate.'
      seen.add(t)
    }
  }
  return errors
}
