import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import { PageShell } from '../components/PageShell'
import { StatusBadge } from '../components/StatusBadge'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { btn } from '../components/ui'
import { friendlyError } from '../lib/errors'
import { formatDateTime } from '../lib/format'
import { exportSurveyCsv, getResults } from '../lib/surveys'
import type { QuestionResult, SurveyResults } from '../lib/types'

const AUTO_REFRESH_MS = 10000

export function ResultsPage() {
  const { id = '' } = useParams()
  const [results, setResults] = useState<SurveyResults | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      setResults(await getResults(id))
      setUpdatedAt(new Date())
      setError(null)
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setRefreshing(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  // Auto-refresh only while the survey is collecting responses (D14).
  useEffect(() => {
    if (results?.status !== 'active') return
    const t = setInterval(() => document.visibilityState === 'visible' && load(), AUTO_REFRESH_MS)
    return () => clearInterval(t)
  }, [results?.status, load])

  async function onExport() {
    setExporting(true)
    setExportError(null)
    try {
      await exportSurveyCsv(id)
    } catch (e) {
      setExportError(friendlyError(e))
    } finally {
      setExporting(false)
    }
  }

  const title = results?.title ?? 'Results'

  return (
    <PageShell
      title={title}
      actions={
        results && (
          <>
            <button type="button" className={btn.secondary} onClick={load} disabled={refreshing}>
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <button type="button" className={btn.secondary} onClick={onExport} disabled={exporting}>
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
            {results.status === 'active' && (
              <Link to={`/surveys/${id}/present`} className={btn.secondary}>
                Present QR
              </Link>
            )}
            <Link to="/dashboard" className={btn.secondary}>
              Back to Dashboard
            </Link>
          </>
        )
      }
    >
      {error && !results ? (
        <ErrorState message={error}>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn.secondary} onClick={load}>
              Try again
            </button>
            <Link to="/dashboard" className={btn.secondary}>
              Back to Dashboard
            </Link>
          </div>
        </ErrorState>
      ) : !results ? (
        <LoadingState label="Loading results..." />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 text-slate-800">
            <StatusBadge status={results.status} />
            <p className="text-xl font-semibold" aria-live="polite">
              {results.response_count} response{results.response_count === 1 ? '' : 's'}
            </p>
            {updatedAt && (
              <p className="text-sm text-slate-700">Updated {updatedAt.toLocaleTimeString()}</p>
            )}
          </div>
          {results.description && <p className="mt-2 text-slate-800">{results.description}</p>}
          <p className="mt-1 text-sm text-slate-700">
            Created {formatDateTime(results.created_at)}
          </p>
          {error && (
            <div className="mt-4">
              <ErrorState message={`Refresh failed: ${error}`} />
            </div>
          )}
          {exportError && (
            <div className="mt-4">
              <ErrorState message={exportError} />
            </div>
          )}

          {results.response_count === 0 ? (
            <div className="mt-6">
              <EmptyState>
                <p className="text-lg">No responses yet.</p>
                {results.status === 'active' && (
                  <p className="mt-1">Display the QR code so students can join.</p>
                )}
              </EmptyState>
            </div>
          ) : (
            <ol className="mt-6 space-y-6">
              {results.questions.map((q, i) => (
                <QuestionChart key={q.question_id} q={q} index={i} />
              ))}
            </ol>
          )}
        </>
      )}
    </PageShell>
  )
}

function QuestionChart({ q, index }: { q: QuestionResult; index: number }) {
  const data = q.choices.map((c) => ({
    name: c.choice_text,
    count: c.count,
    label: `${c.count} (${c.percentage}%)`,
  }))
  const height = Math.max(120, data.length * 56)
  return (
    <li className="rounded-lg border border-slate-300 bg-white p-4">
      <h2 className="text-lg font-semibold">
        {index + 1}. {q.question_text}
      </h2>
      <p className="text-sm text-slate-700">
        {q.response_count} answered
        {q.unanswered_count > 0 && (
          <strong className="text-amber-900"> · {q.unanswered_count} unanswered</strong>
        )}
      </p>
      {q.response_count === 0 ? (
        <p className="mt-3 rounded-md border border-amber-800 bg-amber-50 p-3 font-medium text-amber-900">
          Unanswered: nobody answered this question.
        </p>
      ) : (
        <div className="mt-3" aria-hidden="true" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 4, right: 96, bottom: 4, left: 8 }}
            >
              <CartesianGrid horizontal={false} stroke="#e2e8f0" />
              <XAxis type="number" allowDecimals={false} tick={{ fill: '#334155' }} />
              <YAxis
                type="category"
                dataKey="name"
                width={140}
                tick={{ fill: '#0f172a', fontSize: 14 }}
              />
              <Bar dataKey="count" fill="#1d4ed8" isAnimationActive={false} barSize={28}>
                <LabelList
                  dataKey="label"
                  position="right"
                  fill="#0f172a"
                  fontSize={14}
                  fontWeight={600}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {/* Text table: the source of truth for screen readers and for anyone who can't read the chart. */}
      <table className="mt-3 w-full text-left text-sm">
        <caption className="sr-only">Results for question {index + 1}</caption>
        <thead>
          <tr className="border-b border-slate-300">
            <th scope="col" className="py-1 pr-2 font-semibold">
              Choice
            </th>
            <th scope="col" className="py-1 pr-2 text-right font-semibold">
              Count
            </th>
            <th scope="col" className="py-1 text-right font-semibold">
              Percent
            </th>
          </tr>
        </thead>
        <tbody>
          {q.choices.map((c) => (
            <tr key={c.choice_id} className="border-b border-slate-200">
              <td className="py-1 pr-2">{c.choice_text}</td>
              <td className="py-1 pr-2 text-right tabular-nums">{c.count}</td>
              <td className="py-1 text-right tabular-nums">{c.percentage}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </li>
  )
}
