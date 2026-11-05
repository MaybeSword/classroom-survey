import { describe, expect, it } from 'vitest'
import { buildResultsCsv, csvFilename, escapeCsvCell } from './csv'

describe('escapeCsvCell', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"')
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""')
    expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"')
  })
  it('neutralises formulas', () => {
    expect(escapeCsvCell('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(escapeCsvCell('-1+1')).toBe("'-1+1")
  })
  it('handles null and numbers', () => {
    expect(escapeCsvCell(null)).toBe('')
    expect(escapeCsvCell(3)).toBe('3')
  })
})

describe('buildResultsCsv', () => {
  it('writes metadata, a header of question text, and one row per response', () => {
    const csv = buildResultsCsv({
      survey: {
        title: 'Recursion, part 1',
        description: null,
        status: 'closed',
        public_slug: 'abc234',
        created_at: '2026-08-17T12:00:00Z',
      },
      questions: [
        {
          id: 'q2',
          question_text: 'Second?',
          position: 2,
          choices: [{ id: 't', choice_text: 'True' }],
        },
        {
          id: 'q1',
          question_text: 'What is "base"?',
          position: 1,
          choices: [{ id: 'a', choice_text: 'A, B' }],
        },
      ],
      responses: [
        {
          id: 'r1',
          submitted_at: '2026-08-17T12:10:00Z',
          answers: [
            { question_id: 'q1', choice_id: 'a' },
            { question_id: 'q2', choice_id: 't' },
          ],
        },
      ],
      exportedAt: new Date('2026-08-18T00:00:00Z'),
    })
    const lines = csv.split('\r\n')
    expect(lines[0]).toBe('Survey,"Recursion, part 1"')
    expect(lines).toContain('response_id,submitted_at,"What is ""base""?",Second?')
    expect(lines).toContain('r1,2026-08-17T12:10:00.000Z,"A, B",True')
  })
  it('makes safe filenames', () => {
    expect(csvFilename('Pointer Review!', new Date('2026-08-18T00:00:00Z'))).toBe(
      'pointer-review_2026-08-18.csv',
    )
  })
})
