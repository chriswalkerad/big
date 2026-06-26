import { describe, expect, it } from 'vitest'
import { GET, POST } from './route'

describe('GET /api/speech-token route (availability probe)', () => {
  it('returns { available: false } in the unconfigured test environment without minting', async () => {
    // The test env has no AZURE_SPEECH_* config, so availability is false. This
    // path is config-only: it never calls Azure / mints a token.
    const res = GET()
    const json = await res.json()
    expect(json).toEqual({ available: false })
  })
})

describe('POST /api/speech-token route (mint)', () => {
  it('returns a typed SpeechTokenResponse reflecting the unconfigured test environment', async () => {
    // No AZURE_SPEECH_* config, so the mint short-circuits to a typed AI_UNAVAILABLE.
    const res = await POST()
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error.code).toBe('AI_UNAVAILABLE')
  })

  it('marks the mint response no-store so the live token is never cached', async () => {
    const res = await POST()
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(res.headers.get('Pragma')).toBe('no-cache')
  })
})
