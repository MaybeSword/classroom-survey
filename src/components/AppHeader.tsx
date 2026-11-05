import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { btn } from './ui'

export function AppHeader() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  return (
    <header className="border-b border-slate-300 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link to="/dashboard" className="text-lg font-bold text-slate-900">
          Classroom Survey
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          {user?.email && (
            <span className="text-sm text-slate-700">
              Signed in as <strong className="text-slate-900">{user.email}</strong>
            </span>
          )}
          <button
            type="button"
            className={btn.secondary}
            onClick={async () => {
              await signOut()
              navigate('/login', { replace: true })
            }}
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  )
}
