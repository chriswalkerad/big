import { describe, it, expect, vi } from 'vitest'
import { appError } from '@/lib/errors'
import { getSpeechAvailable, requestSpeechToken } from './speech-token-client'

function jsonResponse(body: unknown, status = 200): Response {
  return {
    status,
    json: async () => body,
  } as unknown as Response
}

describe('requestSpeechToken', () => {
  it('GETs /api/speech-token and parses { token, region }', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse({ ok: true, data: { token: 'tok', region: 'eastus' } }),
    )
    const out = await requestSpeechToken(fetchImpl)
    expect(out).toEqual({ ok: true, data: { token: 'tok', region: 'eastus' } })

    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('/api/speech-token')
    expect(init?.method).toBe('GET')
  })

  it('passes through a typed error response', async () => {
    const err = appError('AI_UNAVAILABLE')
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: false, error: err }, 503))
    const out = await requestSpeechToken(fetchImpl)
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.error.code).toBe('AI_UNAVAILABLE')
  })

  it('maps a network failure to a typed error', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    const out = await requestSpeechToken(fetchImpl)
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
    const out = await requestSpeechToken(fetchImpl)
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.error.code).toBe('AI_BAD_JSON')
  })

  it('falls back to a typed error when the success body lacks data.token/region', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: true, data: { token: 'tok' } }, 200))
    const out = await requestSpeechToken(fetchImpl)
    expect(out.ok).toBe(false)
  })

  it('falls back to a typed error when the body is not a SpeechTokenResponse', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ unexpected: true }, 500))
    const out = await requestSpeechToken(fetchImpl)
    expect(out.ok).toBe(false)
  })
})

describe('getSpeechAvailable', () => {
  it('returns true when a token mint succeeds', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse({ ok: true, data: { token: 'tok', region: 'eastus' } }),
    )
    expect(await getSpeechAvailable(fetchImpl)).toBe(true)
  })

  it('returns false when the mint reports a typed error', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ ok: false, error: appError('AI_UNAVAILABLE') }, 503),
    )
    expect(await getSpeechAvailable(fetchImpl)).toBe(false)
  })

  it('returns false on a network failure', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    expect(await getSpeechAvailable(fetchImpl)).toBe(false)
  })
})
