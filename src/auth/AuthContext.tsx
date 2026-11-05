import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthState {
  session: Session | null
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    supabase.auth
      .getSession()
      .then(({ data }) => mounted && setSession(data.session))
      .catch(() => mounted && setSession(null))
      .finally(() => mounted && setLoading(false))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      async signIn(email, password) {
        try {
          const { error } = await supabase.auth.signInWithPassword({ email, password })
          if (!error) return { error: null }
          if (error.status === 400 || /invalid/i.test(error.message)) {
            return { error: 'Incorrect email or password.' }
          }
          return { error: 'Could not log in. Please try again.' }
        } catch {
          return { error: 'Could not reach the server. Check your connection and try again.' }
        }
      },
      async signOut() {
        await supabase.auth.signOut().catch(() => undefined)
        setSession(null)
      },
    }),
    [session, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
