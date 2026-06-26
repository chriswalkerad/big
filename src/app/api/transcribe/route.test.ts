import { describe, expect, it } from 'vitest'
import { GET, POST } from './route'

describe('GET /api/transcribe route (capability check)', () => {
  it('returns { available: boolean } reflecting the unconfigured environment', async () => {
    // The test env has no Azure transcribe deployment, so this is false.
    const res = GET()
    const json = await res.json()
    expect(json).toHaveProperty('available')
    expect(typeof json.available).toBe('boolean')
    expect(json.available).toBe(false)
  })
})

describe('POST /api/transcribe route', () => {
  // Note: the audio-present paths (transcription, AI_UNAVAILABLE-with-audio, size
  // caps) are exercised in handler.test.ts via handleTranscribe with an injected
  // transcriber. Parsing a real multipart Request body containing a Blob hangs under
  // the jsdom/undici test runtime, so the route tests here cover only the thin
  // Request/Response wrapper around bodies that parse without a file part.

  it('returns a typed 400 for a non-multipart body', async () => {
    const req = new Request('http://localhost/api/transcribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{ not form data',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error.code).toBe('UNKNOWN')
  })

  it('returns a typed error when the audio field is missing', async () => {
    const form = new FormData()
    const req = new Request('http://localhost/api/transcribe', { method: 'POST', body: form })
    const res = await POST(req)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error.code).toBe('UNKNOWN')
  })
})
