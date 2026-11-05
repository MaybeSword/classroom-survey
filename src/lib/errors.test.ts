import { describe, expect, it } from 'vitest'
import { errorCode, friendlyError } from './errors'

describe('friendlyError', () => {
  it('maps RPC codes', () => {
    expect(friendlyError({ message: 'DUPLICATE_RESPONSE' })).toMatch(/already submitted/)
    expect(errorCode({ message: 'SURVEY_NOT_ACTIVE' })).toBe('SURVEY_NOT_ACTIVE')
  })
  it('maps network failures', () => {
    expect(friendlyError(new TypeError('Failed to fetch'))).toMatch(/connection/)
  })
  it('never leaks raw database text', () => {
    const raw = 'duplicate key value violates unique constraint "responses_pkey"'
    expect(friendlyError({ message: raw })).not.toContain('constraint')
  })
})
