import { describe, expect, it, vi } from 'vitest'
import { handleSpeechToken } from './handler'
import type { TranscribeEnv } from '@/lib/providers/select'

const CONFIGURED: TranscribeEnv = {
  AZURE_SPEECH_ENDPOINT: 'https://eastus.api.cognitive.microsoft.com',
  AZURE_SPEECH_KEY: 'speech-key',
  AZURE_SPEECH_REGION: 'eastus',
}

function textResponse(body: string, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  } as unknown as Response
}

describe('handleSpeechToken', () => {
  it('mints a token: POSTs to …/sts/v1.0/issueToken with the key header and returns { token, region }', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => textResponse('the-token'))
    const res = await handleSpeechToken({ env: CONFIGURED, fetchImpl })
    expect(res).toEqual({ ok: true, data: { token: 'the-token', region: 'eastus' } })

    expect(fetchImpl).toHaveBeenCalledOnce()
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://eastus.api.cognitive.microsoft.com/sts/v1.0/issueToken')
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe('')
    const headers = init?.headers as Record<string, string>
    expect(headers['Ocp-Apim-Subscription-Key']).toBe('speech-key')
  })

  it('strips a trailing slash from the endpoint when building the issueToken URL', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => textResponse('tok'))
    await handleSpeechToken({
      env: { ...CONFIGURED, AZURE_SPEECH_ENDPOINT: 'https://eastus.api.cognitive.microsoft.com/' },
      fetchImpl,
    })
    const [url] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://eastus.api.cognitive.microsoft.com/sts/v1.0/issueToken')
  })

  it('returns AI_UNAVAILABLE when the region is missing (unconfigured)', async () => {
    const fetchImpl = vi.fn(async () => textResponse('should not be called'))
    const res = await handleSpeechToken({
      env: { AZURE_SPEECH_ENDPOINT: CONFIGURED.AZURE_SPEECH_ENDPOINT, AZURE_SPEECH_KEY: 'k' },
      fetchImpl,
    })
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error.code).toBe('AI_UNAVAILABLE')
      expect(res.error.retryable).toBe(true)
    }
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('maps a 429 to AI_RATE_LIMIT', async () => {
    const fetchImpl = vi.fn(async () => textResponse('slow down', 429))
    const res = await handleSpeechToken({ env: CONFIGURED, fetchImpl })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('AI_RATE_LIMIT')
  })

  it('maps a 503 to AI_UNAVAILABLE', async () => {
    const fetchImpl = vi.fn(async () => textResponse('down', 503))
    const res = await handleSpeechToken({ env: CONFIGURED, fetchImpl })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('AI_UNAVAILABLE')
  })

  it('maps a 401 to UNKNOWN', async () => {
    const fetchImpl = vi.fn(async () => textResponse('nope', 401))
    const res = await handleSpeechToken({ env: CONFIGURED, fetchImpl })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('UNKNOWN')
  })

  it('maps an offline fetch failure to NETWORK_OFFLINE', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    const res = await handleSpeechToken({ env: CONFIGURED, fetchImpl })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('NETWORK_OFFLINE')
  })

  it('maps an aborted request to AI_TIMEOUT', async () => {
    const fetchImpl = vi.fn(async () => {
      const e = new Error('aborted')
      e.name = 'AbortError'
      throw e
    })
    const res = await handleSpeechToken({ env: CONFIGURED, fetchImpl })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('AI_TIMEOUT')
  })

  it('treats an empty token body as AI_UNAVAILABLE', async () => {
    const fetchImpl = vi.fn(async () => textResponse('   '))
    const res = await handleSpeechToken({ env: CONFIGURED, fetchImpl })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('AI_UNAVAILABLE')
  })
})
