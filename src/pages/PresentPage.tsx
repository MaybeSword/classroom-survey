import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { ConfirmDialog, type ConfirmOptions } from '../components/ConfirmDialog'
import { ErrorState, LoadingState } from '../components/States'
import { btn } from '../components/ui'
import { friendlyError } from '../lib/errors'
import { publicSurveyUrl } from '../lib/publicUrl'
import { closeSurvey, countResponses, getSurvey } from '../lib/surveys'
import type { SurveyWithQuestions } from '../lib/types'
import { csvFilename } from '../lib/csv'

const POLL_MS = 5000

/** Projector view (UI.md §6): big QR, readable URL, live count, minimal chrome. */
export function PresentPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [survey, setSurvey] = useState<SurveyWithQuestions | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [count, setCount] = useState<number | null>(null)
  const [confirm, setConfirm] = useState<ConfirmOptions | null>(null)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    let cancelled = false
    getSurvey(id)
      .then((s) => {
        if (cancelled) return
        if (!s) setError('Survey not found.')
        else {
          setSurvey(s)
          setCount(s.response_count)
          document.title = `${s.title} · Present`
        }
      })
      .catch((e) => !cancelled && setError(friendlyError(e)))
    return () => {
      cancelled = true
    }
  }, [id])

  const url = survey?.public_slug ? publicSurveyUrl(survey.public_slug) : null

  useEffect(() => {
    if (!url) return
    QRCode.toDataURL(url, { width: 1024, margin: 2, errorCorrectionLevel: 'M' })
      .then(setQr)
      .catch(() => setError('Could not create the QR code.'))
  }, [url])

  // Poll the response count while active. Pauses when the tab is hidden.
  useEffect(() => {
    if (survey?.status !== 'active') return
    const tick = () => {
      if (document.visibilityState === 'visible')
        countResponses(id)
          .then(setCount)
          .catch(() => undefined)
    }
    const timer = setInterval(tick, POLL_MS)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [id, survey?.status])

  function askClose() {
    setConfirm({
      title: `Close "${survey?.title}"?`,
      body: <p>Students will no longer be able to submit responses.</p>,
      confirmLabel: 'Close survey',
      onConfirm: async () => {
        setClosing(true)
        try {
          await closeSurvey(id)
          navigate(`/surveys/${id}/results`)
        } catch (e) {
          setError(friendlyError(e))
          setClosing(false)
        }
      },
    })
  }

  if (error)
    return (
      <main className="mx-auto max-w-xl p-6">
        <ErrorState message={error}>
          <Link to="/dashboard" className={btn.secondary}>
            Back to Dashboard
          </Link>
        </ErrorState>
      </main>
    )
  if (!survey) return <LoadingState label="Loading survey..." />

  if (survey.status !== 'active' || !url)
    return (
      <main className="mx-auto max-w-xl p-6 text-slate-900">
        <h1 className="text-2xl font-bold">{survey.title}</h1>
        <p className="mt-4 text-lg">This survey is not active, so there is no QR code to show.</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link to="/dashboard" className={btn.secondary}>
            Back to Dashboard
          </Link>
          <Link to={`/surveys/${id}/results`} className={btn.secondary}>
            View Results
          </Link>
        </div>
      </main>
    )

  const displayUrl = url.replace(/^https?:\/\//, '')

  return (
    <main className="flex min-h-screen flex-col items-center bg-white px-4 py-6 text-slate-950">
      <h1 className="text-center text-3xl font-bold sm:text-5xl">{survey.title}</h1>
      <p className="mt-2 text-lg text-slate-700 sm:text-2xl">Scan to answer</p>
      {qr ? (
        <img
          src={qr}
          alt={`QR code linking to ${displayUrl}`}
          className="mt-6 aspect-square w-[min(80vw,65vh)] max-w-[900px] [image-rendering:pixelated]"
        />
      ) : (
        <div className="mt-6 aspect-square w-[min(80vw,65vh)]" aria-hidden="true" />
      )}
      <p className="mt-4 text-center font-mono text-2xl font-semibold break-all sm:text-4xl">
        {displayUrl}
      </p>
      <p className="mt-4 text-2xl sm:text-3xl" aria-live="polite">
        Responses: <strong>{count ?? '…'}</strong>
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to={`/surveys/${id}/results`} className={btn.secondary}>
          View Results
        </Link>
        {qr && (
          <a
            href={qr}
            download={csvFilename(survey.title, new Date()).replace(/\.csv$/, '_qr.png')}
            className={btn.secondary}
          >
            Download QR Code
          </a>
        )}
        <button
          type="button"
          className={btn.secondary}
          onClick={() => document.documentElement.requestFullscreen?.().catch(() => undefined)}
        >
          Full screen
        </button>
        <button type="button" className={btn.danger} disabled={closing} onClick={askClose}>
          {closing ? 'Closing...' : 'Close Survey'}
        </button>
      </div>
      <Link to="/dashboard" className="mt-6 text-slate-700 underline">
        Dashboard
      </Link>
      <ConfirmDialog options={confirm} onClose={() => setConfirm(null)} />
    </main>
  )
}
