import { Link } from 'react-router-dom'
import { btn } from '../components/ui'

export function NotFoundPage() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center text-slate-900">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <Link to="/" className={`${btn.secondary} mt-6`}>
        Go to home page
      </Link>
    </main>
  )
}
