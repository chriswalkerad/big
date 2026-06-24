import { describe, expect, it } from 'vitest'
import { handleApply } from './handler'
import { appError } from '@/lib/errors'
import { seedDocuments, seedProject } from '@/lib/seed-data'
import type { ReviewProvider } from '@/lib/providers/interface'
import type { ReviewResult } from '@/types'

function bodyFor(text: string, instruction = 'Tighten the opening for clarity.') {
  return { text, instruction, project: seedProject }
}

/** A review provider that only needs applyEdit for these tests. */
function applyProvider(applyEdit: ReviewProvider['applyEdit']): ReviewProvider {
  return {
    async review() {
      throw new Error('not used')
    },
    applyEdit,
  }
}

describe('handleApply', () => {
  it('happy path: returns ok with a visibly changed rewrite on the mock', async () => {
    const original = seedDocuments[0].body
    const res = await handleApply(bodyFor(original), { env: {} })
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(typeof res.data.text).toBe('string')
      expect(res.data.text.length).toBeGreaterThan(0)
      // The mock makes a real, visible edit — never a pure echo.
      expect(res.data.text).not.toBe(original)
    }
  })

  it('is deterministic on the mock: same input → same output', async () => {
    const a = await handleApply(bodyFor(seedDocuments[1].body), { env: {} })
    const b = await handleApply(bodyFor(seedDocuments[1].body), { env: {} })
    expect(a).toEqual(b)
  })

  it('returns EMPTY_DOC for whitespace-only text', async () => {
    const res = await handleApply(bodyFor('   \n\t  '), { env: {} })
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error.code).toBe('EMPTY_DOC')
      expect(res.error.retryable).toBe(false)
    }
  })

  it('returns an error for an invalid request body', async () => {
    const res = await handleApply({ text: 123, instruction: null, project: 'nope' }, { env: {} })
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error.code).toBe('UNKNOWN')
      expect(res.error.cause).toBeDefined()
    }
  })

  it('maps a provider that throws to a typed AppError', async () => {
    const provider = applyProvider(async () => {
      throw appError('AI_RATE_LIMIT')
    })
    const res = await handleApply(bodyFor('A real concept with words.'), { provider })
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error.code).toBe('AI_RATE_LIMIT')
      expect(res.error.retryable).toBe(true)
    }
  })

  it('maps a raw thrown error to a typed AppError', async () => {
    const provider = applyProvider(async () => {
      throw new TypeError('Failed to fetch')
    })
    const res = await handleApply(bodyFor('A real concept with words.'), { provider })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('NETWORK_OFFLINE')
  })

  it('treats an empty rewrite from the provider as AI_BAD_JSON', async () => {
    const provider = applyProvider(async () => '   ')
    const res = await handleApply(bodyFor('A real concept with words.'), { provider })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('AI_BAD_JSON')
  })

  it('passes a non-empty provider rewrite straight through', async () => {
    const provider = applyProvider(async () => 'Rewritten text.')
    const res = await handleApply(bodyFor('Original text.'), { provider })
    expect(res).toEqual({ ok: true, data: { text: 'Rewritten text.' } })
  })

  it('uses the injected provider, not review()', async () => {
    // review() throws if called; reaching ok:true proves only applyEdit ran.
    const provider: ReviewProvider = {
      async review(): Promise<ReviewResult> {
        throw new Error('review must not be called')
      },
      async applyEdit() {
        return 'ok'
      },
    }
    const res = await handleApply(bodyFor('Some text.'), { provider })
    expect(res.ok).toBe(true)
  })
})
