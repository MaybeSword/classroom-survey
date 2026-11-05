import { describe, expect, it } from 'vitest'
import { publicSurveyUrl } from './publicUrl'

describe('publicSurveyUrl', () => {
  it('joins base and slug', () => {
    expect(publicSurveyUrl('x7kf2q', 'https://example.dev/')).toBe('https://example.dev/s/x7kf2q')
  })
  it('falls back to the current origin', () => {
    expect(publicSurveyUrl('abc')).toBe(`${window.location.origin}/s/abc`)
  })
})
