import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** False when .env is missing values. Pages show a setup message instead of failing silently. */
export const supabaseConfigured = Boolean(url && anonKey)

if (!supabaseConfigured && import.meta.env.PROD) {
  console.error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY were not set at build time.')
}

// Placeholder values keep createClient from throwing. Requests then fail with
// a network error, which the UI maps to a friendly message.
export const supabase = createClient(
  url || 'http://supabase-not-configured.invalid',
  anonKey || 'not-configured',
)
