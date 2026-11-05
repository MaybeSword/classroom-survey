import type { ReactNode } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { DashboardPage } from './pages/DashboardPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PresentPage } from './pages/PresentPage'
import { ResultsPage } from './pages/ResultsPage'
import { StudentSurveyPage } from './pages/StudentSurveyPage'
import { SurveyEditorPage } from './pages/SurveyEditorPage'

const guard = (el: ReactNode) => <ProtectedRoute>{el}</ProtectedRoute>

/** Routes from UI.md §1. */
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={guard(<DashboardPage />)} />
          <Route path="/surveys/new" element={guard(<SurveyEditorPage key="new" />)} />
          <Route path="/surveys/:id/edit" element={guard(<SurveyEditorPage />)} />
          <Route path="/surveys/:id/present" element={guard(<PresentPage />)} />
          <Route path="/surveys/:id/results" element={guard(<ResultsPage />)} />
          <Route path="/s/:slug" element={<StudentSurveyPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
