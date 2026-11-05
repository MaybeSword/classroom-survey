/** Anonymous browser token and "already submitted" memory (DECISIONS.md D11). */
const TOKEN_KEY = 'cs_token'
const SUBMITTED_KEY = 'cs_submitted'

let memoryToken: string | null = null

function newToken(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
}

export function getAnonymousToken(): string {
  try {
    let t = localStorage.getItem(TOKEN_KEY)
    if (!t) {
      t = newToken()
      localStorage.setItem(TOKEN_KEY, t)
    }
    return t
  } catch {
    // Private mode / blocked storage: fall back to a per-tab token.
    memoryToken ??= newToken()
    return memoryToken
  }
}

function readSubmitted(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(SUBMITTED_KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function hasSubmitted(surveyId: string): boolean {
  return readSubmitted().includes(surveyId)
}

export function markSubmitted(surveyId: string): void {
  try {
    const list = readSubmitted()
    if (!list.includes(surveyId)) list.push(surveyId)
    localStorage.setItem(SUBMITTED_KEY, JSON.stringify(list.slice(-200)))
  } catch {
    /* ignore */
  }
}
