import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { btn } from '../components/ui'

export function HomePage() {
  useEffect(() => {
    document.title = 'Classroom Survey'
  }, [])
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 px-4 text-center text-slate-900">
      <h1 className="text-4xl font-bold">Classroom Survey</h1>
      <p className="text-lg text-slate-700">Quick in-class understanding checks</p>
      <Link to="/login" className={`${btn.primary} px-6 text-lg`}>
        Instructor Login
      </Link>
    </main>
  )
}
