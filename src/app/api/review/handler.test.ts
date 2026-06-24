import { describe, expect, it } from 'vitest'
import { handleReview } from './handler'
import { appError } from '@/lib/errors'
import { seedDocuments, seedProject, seedSignals } from '@/lib/seed-data'
import type { ReviewProvider } from '@/lib/providers/interface'
import type { ReviewResult } from '@/types'

function bodyFor(text: string) {
  return { text, project: seedProject, signals: seedSignals }
}

describe('handleReview', () => {
  it('happy path: returns ok with a schema-valid ReviewResult on the mock', async () => {
    const res = await handleReview(bodyFor(seedDocuments[0].body), { env: {} })
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.data.signals).toHaveLength(seedSignals.length)
      expect(['looks_ready', 'needs_work', 'not_ready']).toContain(res.data.verdict.label)
    }
  })

  it('returns EMPTY_DOC for whitespace-only text', async () => {
    const res = await handleReview(bodyFor('   \n\t  '), { env: {} })
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error.code).toBe('EMPTY_DOC')
      expect(res.error.retryable).toBe(false)
    }
  })

  it('returns an error for an invalid request body', async () => {
    const res = await handleReview({ text: 123, project: null, signals: 'nope' }, { env: {} })
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error.code).toBe('UNKNOWN')
      expect(res.error.cause).toBeDefined()
    }
  })

  it('returns AI_BAD_JSON when the provider returns a bad shape', async () => {
    const badProvider: ReviewProvider = {
      // Deliberately wrong shape: missing required fields, wrong types.
      async review() {
        return { detectedSubtype: 'not_a_subtype', signals: 'oops' } as unknown as ReviewResult
      },
    }
    const res = await handleReview(bodyFor('A real concept with words.'), { provider: badProvider })
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error.code).toBe('AI_BAD_JSON')
      expect(res.error.cause).toBeDefined()
    }
  })

  it('maps a provider that throws to a typed AppError', async () => {
    const throwingProvider: ReviewProvider = {
      async review() {
        throw appError('AI_RATE_LIMIT')
      },
    }
    const res = await handleReview(bodyFor('A real concept with words.'), { provider: throwingProvider })
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error.code).toBe('AI_RATE_LIMIT')
      expect(res.error.retryable).toBe(true)
    }
  })

  it('passes a valid provider result straight through', async () => {
    const valid: ReviewResult = {
      detectedSubtype: 'story_premise',
      suggestedTitle: 'Title',
      themes: ['friendship'],
      signals: [{ signalId: 'clarity', score: 8, rationale: 'clear', issues: [] }],
      verdict: { label: 'looks_ready', flagCount: 0 },
    }
    const provider: ReviewProvider = { async review() { return valid } }
    const res = await handleReview(bodyFor('A real concept with words.'), { provider })
    expect(res).toEqual({ ok: true, data: valid })
  })
})
