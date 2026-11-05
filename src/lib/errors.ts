/** Error codes raised by the database functions (supabase/migrations). */
const MESSAGES: Record<string, string> = {
  SURVEY_NOT_ACTIVE: 'This survey is no longer accepting responses.',
  DUPLICATE_RESPONSE: 'You have already submitted a response to this survey.',
  INVALID_QUESTION: 'This survey has changed. Please reload the page and try again.',
  INVALID_CHOICE: 'This survey has changed. Please reload the page and try again.',
  MISSING_REQUIRED_ANSWER: 'Please answer every question before submitting.',
  INVALID_REQUEST: 'Something went wrong with this request. Please reload the page and try again.',
  SURVEY_NOT_FOUND: 'Survey not found.',
  SURVEY_ACTIVE: 'This survey is active. Close it first.',
  SURVEY_HAS_RESPONSES:
    'This survey already has responses, so its questions cannot change. Duplicate it to make an edited copy.',
  SURVEY_HAS_NO_QUESTIONS: 'Add at least one question before activating.',
  VALIDATION_ERROR: 'Some fields are missing or invalid. Fix the highlighted fields and try again.',
  INVALID_STATUS_TRANSITION: 'That action is not allowed for a survey in this state.',
  SLUG_GENERATION_FAILED: 'Could not create a public link. Please try again.',
}

const NETWORK = 'Could not reach the server. Check your connection and try again.'
const AUTH = 'Your session has expired. Please log in again.'
const UNEXPECTED = 'Something went wrong. Please try again.'

/** Pull a known error code out of any Supabase/fetch error. */
export function errorCode(err: unknown): string | null {
  const message = typeof err === 'object' && err && 'message' in err ? String(err.message) : ''
  const code = message.trim()
  return code in MESSAGES ? code : null
}

/**
 * Turn any error into text that is safe to show. Raw database messages are
 * never returned.
 */
export function friendlyError(err: unknown): string {
  const code = errorCode(err)
  if (code) return MESSAGES[code]
  const e = (typeof err === 'object' && err ? err : {}) as {
    message?: string
    code?: string
    status?: number
  }
  const msg = e.message ?? ''
  if (/failed to fetch|network|load failed|fetch failed/i.test(msg)) return NETWORK
  if (e.status === 401 || e.code === 'PGRST301' || /jwt/i.test(msg)) return AUTH
  if (e.code === '42501') return 'You do not have permission to do that.'
  return UNEXPECTED
}
