import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { btn, input, label } from '../components/ui'
import { ConfigWarning } from '../components/PageShell'
import { LoadingState } from '../components/States'

export function LoginPage() {
  const { user, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    document.title = 'Instructor Login · Classroom Survey'
  }, [])

  if (loading) return <LoadingState label="Loading..." />
  if (user) return <Navigate to={from} replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await signIn(email.trim(), password)
    setBusy(false)
    if (res.error) setError(res.error)
    else navigate(from, { replace: true })
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-slate-900">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-xl border border-slate-300 bg-white p-6 shadow-sm"
        noValidate
      >
        <ConfigWarning />
        <h1 className="text-2xl font-bold">Instructor Login</h1>
        <div className="mt-6">
          <label htmlFor="email" className={label}>
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            required
            className={input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="mt-4">
          <label htmlFor="password" className={label}>
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            className={input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="mt-4 font-medium text-red-800">
            {error}
          </p>
        )}
        <button
          type="submit"
          className={`${btn.primary} mt-6 w-full`}
          disabled={busy || !email || !password}
        >
          {busy ? 'Logging in...' : 'Log In'}
        </button>
      </form>
    </main>
  )
}
