import { describe, expect, it } from 'vitest'
import { GET } from './route'

describe('GET /api/speech-token route', () => {
  it('returns a typed SpeechTokenResponse reflecting the unconfigured test environment', async () => {
    // The test env has no AZURE_SPEECH_* config, so the mint short-circuits to a
    // typed AI_UNAVAILABLE (which doubles as the UI "unavailable" signal).
    const res = await GET()
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error.code).toBe('AI_UNAVAILABLE')
  })
})
