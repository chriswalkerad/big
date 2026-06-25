import { describe, it, expect, vi } from 'vitest'
import type { Project } from '@/types'
import { appError } from '@/lib/errors'
import { requestApply } from './apply-client'

const PROJECT: Project = {
  id: 'proj-eloise',
  name: 'Eloise at The Plaza',
  audience: 'Kids 6-12',
  franchiseContext: 'context',
  tags: [],
  owner: { id: 'person-maya-kambe', name: 'Maya Kambe', role: 'Animation Development & Production Executive' },
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    status,
    json: async () => body,
  } as unknown as Response
}

describe('requestApply', () => {
  it('posts text/instruction/project and returns the data on success', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse({ ok: true, data: { text: 'rewritten' } }),
    )
    const out = await requestApply({
      text: 'hello',
      instruction: 'tighten it',
      project: PROJECT,
      fetchImpl,
    })
    expect(out).toEqual({ ok: true, data: { text: 'rewritten' } })

    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('/api/apply')
    const sent = JSON.parse(init?.body as string)
    expect(sent).toEqual({ text: 'hello', instruction: 'tighten it', project: PROJECT })
  })

  it('passes through a typed error response', async () => {
    const err = appError('AI_RATE_LIMIT')
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: false, error: err }, 429))
    const out = await requestApply({
      text: 'hi',
      instruction: 'go',
      project: PROJECT,
      fetchImpl,
    })
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.error.code).toBe('AI_RATE_LIMIT')
  })

  it('maps a network failure to a typed error', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    const out = await requestApply({
      text: 'hi',
      instruction: 'go',
      project: PROJECT,
      fetchImpl,
    })
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
    const out = await requestApply({
      text: 'hi',
      instruction: 'go',
      project: PROJECT,
      fetchImpl,
    })
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.error.code).toBe('AI_BAD_JSON')
  })

  it('falls back to a typed error when the success body lacks data.text', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: true, data: { notText: 1 } }, 200))
    const out = await requestApply({
      text: 'hi',
      instruction: 'go',
      project: PROJECT,
      fetchImpl,
    })
    expect(out.ok).toBe(false)
  })

  it('falls back to a typed error when the body is not an ApplyResponse', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ unexpected: true }, 500))
    const out = await requestApply({
      text: 'hi',
      instruction: 'go',
      project: PROJECT,
      fetchImpl,
    })
    expect(out.ok).toBe(false)
  })
})
