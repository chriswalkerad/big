import { describe, it, expect, vi } from 'vitest'
import type { Project, ReviewResult, SignalDef } from '@/types'
import { appError } from '@/lib/errors'
import { requestReview } from './review-client'

const PROJECT: Project = {
  id: 'proj-eloise',
  name: 'Eloise at The Plaza',
  audience: 'Kids 6-12',
  franchiseContext: 'context',
  tags: [],
  owner: { id: 'person-maya-kambe', name: 'Maya Kambe', role: 'Animation Development & Production Executive' },
}

const SIGNALS: SignalDef[] = [
  { id: 'clarity', name: 'Clarity', mode: 'inline', threshold: 7, prompt: '' },
]

const RESULT: ReviewResult = {
  detectedSubtype: 'story_premise',
  suggestedTitle: 'Title',
  themes: [],
  signals: [],
  verdict: { label: 'looks_ready', flagCount: 0 },
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    status,
    json: async () => body,
  } as unknown as Response
}

describe('requestReview', () => {
  it('posts text/project/signals and returns the data on success', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ ok: true, data: RESULT }))
    const out = await requestReview({ text: 'hello', project: PROJECT, signals: SIGNALS, fetchImpl })
    expect(out).toEqual({ ok: true, data: RESULT })

    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('/api/review')
    const sent = JSON.parse(init?.body as string)
    expect(sent).toEqual({ text: 'hello', project: PROJECT, signals: SIGNALS })
  })

  it('passes through a typed error response', async () => {
    const err = appError('AI_RATE_LIMIT')
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: false, error: err }, 429))
    const out = await requestReview({ text: 'hi', project: PROJECT, signals: SIGNALS, fetchImpl })
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.error.code).toBe('AI_RATE_LIMIT')
  })

  it('maps a network failure to a typed error', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    const out = await requestReview({ text: 'hi', project: PROJECT, signals: SIGNALS, fetchImpl })
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.error.code).toBe('NETWORK_OFFLINE')
  })

  it('maps malformed JSON to AI_BAD_JSON', async () => {
    const fetchImpl = vi.fn(
      async () =>
        ({
          status: 200,
          json: async () => {
            throw new SyntaxError('Unexpected token')
          },
        }) as unknown as Response,
    )
    const out = await requestReview({ text: 'hi', project: PROJECT, signals: SIGNALS, fetchImpl })
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.error.code).toBe('AI_BAD_JSON')
  })

  it('falls back to a typed error when the success body has null data', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: true, data: null }, 200))
    const out = await requestReview({ text: 'hi', project: PROJECT, signals: SIGNALS, fetchImpl })
    expect(out.ok).toBe(false)
  })

  it('falls back to a typed error when the success body data lacks signals/verdict shape', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: true, data: { signals: 'nope' } }, 200))
    const out = await requestReview({ text: 'hi', project: PROJECT, signals: SIGNALS, fetchImpl })
    expect(out.ok).toBe(false)
  })

  it('falls back to a typed error when the body is not a ReviewResponse', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ unexpected: true }, 500))
    const out = await requestReview({ text: 'hi', project: PROJECT, signals: SIGNALS, fetchImpl })
    expect(out.ok).toBe(false)
  })
})
