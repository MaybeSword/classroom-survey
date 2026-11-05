import { useEffect, type ReactNode } from 'react'
import { AppHeader } from './AppHeader'
import { supabaseConfigured } from '../lib/supabase'

/** Layout for instructor pages: header, width-limited main column, page title. */
export function PageShell({
  title,
  actions,
  children,
}: {
  title: string
  actions?: ReactNode
  children?: ReactNode
}) {
  useEffect(() => {
    document.title = `${title} · Classroom Survey`
  }, [title])
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
        <ConfigWarning />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
        <div className="mt-6">{children}</div>
      </main>
    </div>
  )
}

export function ConfigWarning() {
  if (supabaseConfigured) return null
  return (
    <p
      role="alert"
      className="mb-4 rounded-lg border border-amber-800 bg-amber-50 p-3 text-amber-900"
    >
      Supabase is not configured. Copy <code>.env.example</code> to <code>.env</code>, fill in the
      values, and restart the dev server.
    </p>
  )
}
