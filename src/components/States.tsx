import type { ReactNode } from 'react'

export function LoadingState({ label }: { label: string }) {
  return (
    <p role="status" className="py-10 text-center text-lg text-slate-700">
      {label}
    </p>
  )
}

export function ErrorState({ message, children }: { message: string; children?: ReactNode }) {
  return (
    <div role="alert" className="rounded-lg border border-red-700 bg-red-50 p-4 text-red-900">
      <p className="font-medium">{message}</p>
      {children && <div className="mt-3">{children}</div>}
    </div>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-400 p-8 text-center text-slate-700">
      {children}
    </div>
  )
}
