import { describe, it, expect } from 'vitest'
import { appError, isAppError, toAppError, type AppErrorCode } from './errors'

describe('appError', () => {
  it('defaults message and retryable from the code', () => {
    const e = appError('EMPTY_DOC')
    expect(e.code).toBe('EMPTY_DOC')
    expect(e.retryable).toBe(false)
    expect(e.message).toMatch(/add some text/i)
  })

  it('keeps an explicit message', () => {
    expect(appError('UNKNOWN', 'boom').message).toBe('boom')
  })
})

describe('isAppError', () => {
  it('recognises AppError shapes and rejects others', () => {
    expect(isAppError(appError('UNKNOWN'))).toBe(true)
    expect(isAppError(new Error('x'))).toBe(false)
    expect(isAppError(null)).toBe(false)
    expect(isAppError('nope')).toBe(false)
  })
})

describe('toAppError', () => {
  it('passes through an existing AppError unchanged', () => {
    const original = appError('DOC_NOT_FOUND')
    expect(toAppError(original)).toBe(original)
  })

  const cases: Array<{ name: string; input: unknown; code: AppErrorCode; retryable: boolean }> = [
    { name: 'AbortError → AI_TIMEOUT', input: Object.assign(new Error('aborted'), { name: 'AbortError' }), code: 'AI_TIMEOUT', retryable: true },
    { name: 'timeout message → AI_TIMEOUT', input: new Error('Request timed out'), code: 'AI_TIMEOUT', retryable: true },
    { name: 'status 429 → AI_RATE_LIMIT', input: { status: 429, message: 'slow down' }, code: 'AI_RATE_LIMIT', retryable: true },
    { name: 'rate limit message → AI_RATE_LIMIT', input: new Error('rate limit exceeded'), code: 'AI_RATE_LIMIT', retryable: true },
    { name: 'status 503 → AI_UNAVAILABLE', input: { status: 503, message: 'The model is overloaded' }, code: 'AI_UNAVAILABLE', retryable: true },
    { name: 'high-demand message → AI_UNAVAILABLE', input: new Error('This model is currently experiencing high demand'), code: 'AI_UNAVAILABLE', retryable: true },
    { name: 'SyntaxError → AI_BAD_JSON', input: new SyntaxError('Unexpected token < in JSON'), code: 'AI_BAD_JSON', retryable: true },
    { name: 'TypeError fetch → NETWORK_OFFLINE', input: new TypeError('Failed to fetch'), code: 'NETWORK_OFFLINE', retryable: true },
    { name: 'QuotaExceededError → STORAGE_QUOTA', input: Object.assign(new Error('exceeded'), { name: 'QuotaExceededError' }), code: 'STORAGE_QUOTA', retryable: false },
    { name: 'localStorage message → STORAGE_UNAVAILABLE', input: new Error('localStorage is not available'), code: 'STORAGE_UNAVAILABLE', retryable: false },
    { name: 'unknown string → UNKNOWN', input: 'weird', code: 'UNKNOWN', retryable: false },
  ]

  for (const c of cases) {
    it(c.name, () => {
      const e = toAppError(c.input)
      expect(e.code).toBe(c.code)
      expect(e.retryable).toBe(c.retryable)
      expect(e.cause).toBe(c.input)
    })
  }

  it('round-trips DOC_NOT_FOUND and EMPTY_DOC via pass-through', () => {
    expect(toAppError(appError('DOC_NOT_FOUND')).code).toBe('DOC_NOT_FOUND')
    expect(toAppError(appError('EMPTY_DOC')).code).toBe('EMPTY_DOC')
  })
})
