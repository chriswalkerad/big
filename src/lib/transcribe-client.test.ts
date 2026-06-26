import { describe, it, expect, vi } from 'vitest'
import { appError } from '@/lib/errors'
import { getTranscribeAvailable, requestTranscribe } from './transcribe-client'

function jsonResponse(body: unknown, status = 200): Response {
  return {
    status,
    json: async () => body,
  } as unknown as Response
}

function audioBlob(): Blob {
  return new Blob([new Uint8Array(16)], { type: 'audio/webm' })
}

describe('requestTranscribe', () => {
  it('posts multipart form data with the audio field and returns the data', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse({ ok: true, data: { text: 'transcribed' } }),
    )
    const out = await requestTranscribe(audioBlob(), { fetchImpl })
    expect(out).toEqual({ ok: true, data: { text: 'transcribed' } })

    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('/api/transcribe')
    expect(init?.method).toBe('POST')
    expect(init?.body).toBeInstanceOf(FormData)
    const sent = init?.body as FormData
    expect(sent.get('audio')).toBeInstanceOf(Blob)
  })

  it('passes through a typed error response', async () => {
    const err = appError('AI_UNAVAILABLE')
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: false, error: err }, 503))
    const out = await requestTranscribe(audioBlob(), { fetchImpl })
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.error.code).toBe('AI_UNAVAILABLE')
  })

  it('maps a network failure to a typed error', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    const out = await requestTranscribe(audioBlob(), { fetchImpl })
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
    const out = await requestTranscribe(audioBlob(), { fetchImpl })
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.error.code).toBe('AI_BAD_JSON')
  })

  it('falls back to a typed error when the success body lacks data.text', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: true, data: { notText: 1 } }, 200))
    const out = await requestTranscribe(audioBlob(), { fetchImpl })
    expect(out.ok).toBe(false)
  })

  it('falls back to a typed error when the body is not a TranscribeResponse', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ unexpected: true }, 500))
    const out = await requestTranscribe(audioBlob(), { fetchImpl })
    expect(out.ok).toBe(false)
  })
})

describe('getTranscribeAvailable', () => {
  it('returns true when the server reports available', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ available: true }))
    expect(await getTranscribeAvailable(fetchImpl)).toBe(true)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('/api/transcribe')
    expect(init?.method).toBe('GET')
  })

  it('returns false when the server reports unavailable', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ available: false }))
    expect(await getTranscribeAvailable(fetchImpl)).toBe(false)
  })

  it('returns false on a network failure', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    expect(await getTranscribeAvailable(fetchImpl)).toBe(false)
  })
})
