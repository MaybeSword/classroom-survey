import { describe, expect, it } from 'vitest'
import { validateSurvey, type DraftSurvey } from './validation'

const base: DraftSurvey = {
  title: 'Quiz',
  description: '',
  questions: [
    {
      key: 'q1',
      question_text: 'Q?',
      question_type: 'multiple_choice',
      choices: [
        { key: 'a', choice_text: 'A' },
        { key: 'b', choice_text: 'B' },
      ],
    },
  ],
}

describe('validateSurvey', () => {
  it('accepts a valid survey', () => expect(validateSurvey(base)).toEqual({}))
  it('requires a title and a question', () => {
    const e = validateSurvey({ ...base, title: ' ', questions: [] })
    expect(e.title).toBeTruthy()
    expect(e.questions).toBeTruthy()
  })
  it('flags empty, duplicate and too few choices', () => {
    const e = validateSurvey({
      ...base,
      questions: [
        {
          key: 'q1',
          question_text: '',
          question_type: 'multiple_choice',
          choices: [{ key: 'a', choice_text: 'x' }],
        },
      ],
    })
    expect(e['q:q1:text']).toBeTruthy()
    expect(e['q:q1:choices']).toBeTruthy()
    const d = validateSurvey({
      ...base,
      questions: [
        {
          key: 'q1',
          question_text: 'Q',
          question_type: 'multiple_choice',
          choices: [
            { key: 'a', choice_text: 'X' },
            { key: 'b', choice_text: 'x ' },
          ],
        },
      ],
    })
    expect(d['c:b']).toMatch(/duplicate/)
  })
  it('does not require choices for true/false', () => {
    expect(
      validateSurvey({
        ...base,
        questions: [{ key: 'q', question_text: 'T?', question_type: 'true_false', choices: [] }],
      }),
    ).toEqual({})
  })
})
