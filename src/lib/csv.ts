/** CSV helpers (DECISIONS.md D15). RFC 4180 quoting plus spreadsheet formula-injection guard. */

export function escapeCsvCell(value: unknown): string {
  let s = value == null ? '' : String(value)
  // Cells starting with = + - @ (or tab/CR) can run as formulas in Excel/Sheets.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`
  return s
}

export function toCsv(rows: unknown[][]): string {
  return rows.map((r) => r.map(escapeCsvCell).join(',')).join('\r\n') + '\r\n'
}

export interface CsvExportInput {
  survey: {
    title: string
    description: string | null
    status: string
    public_slug: string | null
    created_at: string
  }
  questions: {
    id: string
    question_text: string
    position: number
    choices: { id: string; choice_text: string }[]
  }[]
  responses: {
    id: string
    submitted_at: string
    answers: { question_id: string; choice_id: string | null }[]
  }[]
  exportedAt: Date
}

/**
 * Metadata block, one blank line, then the response table:
 * response_id, submitted_at, <question text>... with choice text in each cell.
 */
export function buildResultsCsv({
  survey,
  questions,
  responses,
  exportedAt,
}: CsvExportInput): string {
  const qs = [...questions].sort((a, b) => a.position - b.position)
  const choiceText = new Map<string, string>()
  for (const q of qs) for (const c of q.choices) choiceText.set(c.id, c.choice_text)

  const rows: unknown[][] = [
    ['Survey', survey.title],
    ['Description', survey.description ?? ''],
    ['Status', survey.status],
    ['Public slug', survey.public_slug ?? ''],
    ['Created at', survey.created_at],
    ['Exported at', exportedAt.toISOString()],
    ['Responses', responses.length],
    [],
    ['response_id', 'submitted_at', ...qs.map((q) => q.question_text)],
  ]
  const sorted = [...responses].sort((a, b) => a.submitted_at.localeCompare(b.submitted_at))
  for (const r of sorted) {
    const byQ = new Map(r.answers.map((a) => [a.question_id, a.choice_id]))
    rows.push([
      r.id,
      new Date(r.submitted_at).toISOString(),
      ...qs.map((q) => {
        const cid = byQ.get(q.id)
        return cid ? (choiceText.get(cid) ?? '') : ''
      }),
    ])
  }
  return toCsv(rows)
}

export function csvFilename(title: string, date: Date): string {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'survey'
  return `${base}_${date.toISOString().slice(0, 10)}.csv`
}

/** Starts a browser download. The BOM makes Excel read UTF-8 correctly. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
