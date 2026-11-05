import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { StatusBadge } from '../components/StatusBadge'
import { ConfirmDialog, type ConfirmOptions } from '../components/ConfirmDialog'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { btn, input, label } from '../components/ui'
import { friendlyError } from '../lib/errors'
import { formatDate } from '../lib/format'
import {
  activateSurvey,
  closeSurvey,
  deleteSurvey,
  duplicateSurvey,
  listSurveys,
  setStatus,
} from '../lib/surveys'
import type { SurveyListItem, SurveyStatus } from '../lib/types'

type Filter = 'all' | SurveyStatus

export function DashboardPage() {
  const navigate = useNavigate()
  const [surveys, setSurveys] = useState<SurveyListItem[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<ConfirmOptions | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatusFilter] = useState<Filter>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      setSurveys(await listSurveys())
    } catch (e) {
      setLoadError(friendlyError(e))
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    if (!surveys) return []
    const q = search.trim().toLowerCase()
    const fromT = from ? new Date(`${from}T00:00:00`).getTime() : -Infinity
    const toT = to ? new Date(`${to}T23:59:59.999`).getTime() : Infinity
    return surveys.filter((s) => {
      const t = new Date(s.created_at).getTime()
      return (
        (!q || s.title.toLowerCase().includes(q)) &&
        (status === 'all' || s.status === status) &&
        t >= fromT &&
        t <= toT
      )
    })
  }, [surveys, search, status, from, to])

  async function run(id: string, action: () => Promise<unknown>, after?: () => void) {
    setBusyId(id)
    setActionError(null)
    try {
      await action()
      if (after) after()
      else await load()
    } catch (e) {
      setActionError(friendlyError(e))
    } finally {
      setBusyId(null)
    }
  }

  const activeSurvey = surveys?.find((s) => s.status === 'active')

  function askActivate(s: SurveyListItem) {
    const go = () =>
      run(
        s.id,
        () => activateSurvey(s.id),
        () => navigate(`/surveys/${s.id}/present`),
      )
    if (activeSurvey && activeSurvey.id !== s.id) {
      setConfirm({
        title: `Activate "${s.title}"?`,
        body: (
          <p>
            "{activeSurvey.title}" is active now. It will be closed and stop accepting responses.
          </p>
        ),
        confirmLabel: 'Activate',
        onConfirm: go,
      })
    } else go()
  }

  function askClose(s: SurveyListItem) {
    setConfirm({
      title: `Close "${s.title}"?`,
      body: <p>Students will no longer be able to submit responses. You can reopen it later.</p>,
      confirmLabel: 'Close survey',
      onConfirm: () => run(s.id, () => closeSurvey(s.id)),
    })
  }

  function askArchive(s: SurveyListItem) {
    setConfirm({
      title: `Archive "${s.title}"?`,
      body: (
        <p>
          Archived surveys are hidden from the default list but keep all their responses. You can
          unarchive later.
        </p>
      ),
      confirmLabel: 'Archive',
      onConfirm: () => run(s.id, () => setStatus(s.id, 'archived')),
    })
  }

  function askDelete(s: SurveyListItem) {
    const hasResponses = s.response_count > 0
    setConfirm({
      title: `Delete "${s.title}"?`,
      body: hasResponses ? (
        <>
          <p>
            <strong>
              This survey has {s.response_count} response{s.response_count === 1 ? '' : 's'}.
            </strong>{' '}
            Deleting it permanently removes the survey and every response. This cannot be undone.
          </p>
          {s.status !== 'archived' && (
            <p>Archive keeps the results and hides the survey instead.</p>
          )}
        </>
      ) : (
        <p>This will permanently delete the survey and its questions.</p>
      ),
      confirmLabel: 'Delete',
      danger: true,
      requireText: hasResponses ? s.title : undefined,
      alternative:
        hasResponses && s.status !== 'archived'
          ? {
              label: 'Archive instead',
              onSelect: () => run(s.id, () => setStatus(s.id, 'archived')),
            }
          : undefined,
      onConfirm: () => run(s.id, () => deleteSurvey(s.id)),
    })
  }

  return (
    <PageShell
      title="Dashboard"
      actions={
        <Link to="/surveys/new" className={btn.primary}>
          + New Survey
        </Link>
      }
    >
      {loadError ? (
        <ErrorState message={loadError}>
          <button type="button" className={btn.secondary} onClick={load}>
            Try again
          </button>
        </ErrorState>
      ) : !surveys ? (
        <LoadingState label="Loading surveys..." />
      ) : surveys.length === 0 ? (
        <EmptyState>
          <p className="text-lg">You have not created any surveys yet.</p>
          <Link to="/surveys/new" className={`${btn.primary} mt-4`}>
            Create Your First Survey
          </Link>
        </EmptyState>
      ) : (
        <>
          <div
            className="grid gap-4 rounded-lg border border-slate-300 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"
            role="search"
          >
            <div>
              <label htmlFor="search" className={label}>
                Search
              </label>
              <input
                id="search"
                type="search"
                className={input}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Survey title"
              />
            </div>
            <div>
              <label htmlFor="status" className={label}>
                Status
              </label>
              <select
                id="status"
                className={input}
                value={status}
                onChange={(e) => setStatusFilter(e.target.value as Filter)}
              >
                <option value="all">All</option>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div>
              <label htmlFor="from" className={label}>
                Created from
              </label>
              <input
                id="from"
                type="date"
                className={input}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="to" className={label}>
                Created to
              </label>
              <input
                id="to"
                type="date"
                className={input}
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>

          {actionError && (
            <div className="mt-4">
              <ErrorState message={actionError} />
            </div>
          )}

          <p className="mt-4 text-sm text-slate-700" aria-live="polite">
            Showing {filtered.length} of {surveys.length} surveys
          </p>

          {filtered.length === 0 ? (
            <div className="mt-4">
              <EmptyState>No surveys match your search.</EmptyState>
            </div>
          ) : (
            <ul className="mt-3 grid gap-4 lg:grid-cols-2">
              {filtered.map((s) => {
                const busy = busyId === s.id
                return (
                  <li
                    key={s.id}
                    className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h2 className="text-lg font-semibold break-words">{s.title}</h2>
                      <StatusBadge status={s.status} />
                    </div>
                    <p className="mt-1 text-sm text-slate-700">
                      Created {formatDate(s.created_at)} · {s.response_count} response
                      {s.response_count === 1 ? '' : 's'}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2" aria-busy={busy}>
                      {(s.status === 'draft' ||
                        (s.status === 'closed' && s.response_count === 0)) && (
                        <Link to={`/surveys/${s.id}/edit`} className={btn.small}>
                          Edit
                        </Link>
                      )}
                      {s.status === 'closed' && s.response_count > 0 && (
                        <Link to={`/surveys/${s.id}/edit`} className={btn.small}>
                          Edit title
                        </Link>
                      )}
                      {(s.status === 'draft' || s.status === 'closed') && (
                        <button
                          type="button"
                          className={btn.small}
                          disabled={busy}
                          onClick={() => askActivate(s)}
                        >
                          {s.status === 'closed' ? 'Reopen' : 'Activate'}
                        </button>
                      )}
                      {s.status === 'active' && (
                        <>
                          <Link to={`/surveys/${s.id}/present`} className={btn.small}>
                            Present
                          </Link>
                          <button
                            type="button"
                            className={btn.small}
                            disabled={busy}
                            onClick={() => askClose(s)}
                          >
                            Close
                          </button>
                        </>
                      )}
                      {s.status !== 'draft' && (
                        <Link to={`/surveys/${s.id}/results`} className={btn.small}>
                          View Results
                        </Link>
                      )}
                      <button
                        type="button"
                        className={btn.small}
                        disabled={busy}
                        onClick={() =>
                          run(
                            s.id,
                            () =>
                              duplicateSurvey(s.id).then((id) => navigate(`/surveys/${id}/edit`)),
                            () => undefined,
                          )
                        }
                      >
                        Duplicate
                      </button>
                      {(s.status === 'draft' || s.status === 'closed') && (
                        <button
                          type="button"
                          className={btn.small}
                          disabled={busy}
                          onClick={() => askArchive(s)}
                        >
                          Archive
                        </button>
                      )}
                      {s.status === 'archived' && (
                        <button
                          type="button"
                          className={btn.small}
                          disabled={busy}
                          onClick={() => run(s.id, () => setStatus(s.id, 'closed'))}
                        >
                          Unarchive
                        </button>
                      )}
                      {s.status !== 'active' && (
                        <button
                          type="button"
                          className={btn.smallDanger}
                          disabled={busy}
                          onClick={() => askDelete(s)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
      <ConfirmDialog options={confirm} onClose={() => setConfirm(null)} />
    </PageShell>
  )
}
