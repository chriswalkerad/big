import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the OpenAI SDK so the provider is testable without a network call. The
// constructor just stores options; `chat.completions.create` is the seam.
const createMock = vi.fn()
vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create: createMock } }
  },
}))

import { AzureProvider, DEFAULT_AZURE_DEPLOYMENT, transcribeAudio } from './azure'
import { seedProject, seedSignals } from '@/lib/seed-data'
import type { ReviewInput } from './interface'
import type { ReviewResult } from '@/types'
import type { TranscribeEnv } from './select'

const input: ReviewInput = {
  text: 'Eloise runs a secret midnight room-service operation at the Plaza.',
  project: seedProject,
  signals: seedSignals,
}

const validResult: ReviewResult = {
  detectedSubtype: 'story_premise',
  suggestedTitle: 'Midnight Room Service',
  themes: ['mischief'],
  signals: [{ signalId: 'clarity', score: 80, rationale: 'Clear.', issues: [] }],
  verdict: { label: 'needs_work', flagCount: 1 },
}

describe('AzureProvider', () => {
  beforeEach(() => createMock.mockReset())

  it('defaults the deployment to gpt-5.5', () => {
    expect(DEFAULT_AZURE_DEPLOYMENT).toBe('gpt-5.5')
  })

  it('parses a structured completion into a ReviewResult and sends json_schema output', async () => {
    createMock.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(validResult) } }] })
    const provider = new AzureProvider('https://r.services.ai.azure.com/openai/v1', 'key', 'gpt-5.5')
    const out = await provider.review(input)
    expect(out).toEqual(validResult)
    const args = createMock.mock.calls[0][0]
    expect(args.model).toBe('gpt-5.5')
    expect(args.response_format.type).toBe('json_schema')
    expect(args.response_format.json_schema.strict).toBe(true)
    // The system message carries the shared verbatim-quote rule.
    expect(String(args.messages[0].content).toLowerCase()).toContain('verbatim')
  })

  it('falls back to the default deployment when none is given', async () => {
    createMock.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(validResult) } }] })
    const provider = new AzureProvider('https://r/openai/v1', 'key')
    await provider.review(input)
    expect(createMock.mock.calls[0][0].model).toBe('gpt-5.5')
  })

  it('maps an empty response to AI_BAD_JSON', async () => {
    createMock.mockResolvedValue({ choices: [{ message: { content: '' } }] })
    const provider = new AzureProvider('https://r/openai/v1', 'key')
    await expect(provider.review(input)).rejects.toMatchObject({ code: 'AI_BAD_JSON' })
  })

  it('maps unparseable content to AI_BAD_JSON', async () => {
    createMock.mockResolvedValue({ choices: [{ message: { content: 'not json' } }] })
    const provider = new AzureProvider('https://r/openai/v1', 'key')
    await expect(provider.review(input)).rejects.toMatchObject({ code: 'AI_BAD_JSON' })
  })

  // SDK transport errors (429/5xx/timeout) flow through the catch -> toAppError,
  // whose status mapping (429 -> AI_RATE_LIMIT, 5xx -> AI_UNAVAILABLE, etc.) is
  // covered directly in errors.test.ts. The catch -> toAppError path itself is
  // exercised by the AI_BAD_JSON cases above.
})

describe('transcribeAudio (Azure AI Speech fast transcription)', () => {
  const CONFIGURED: TranscribeEnv = {
    AZURE_SPEECH_ENDPOINT: 'https://eastus.api.cognitive.microsoft.com/',
    AZURE_SPEECH_KEY: 'speech-key',
    AZURE_SPEECH_TRANSCRIBE_MODEL: 'mai-transcribe-1.5',
  }

  function audioBlob(): Blob {
    return new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'audio/wav' })
  }

  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  }

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('throws AI_UNAVAILABLE when unconfigured (no fetch call)', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    await expect(transcribeAudio(audioBlob(), {})).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('happy path: POSTs multipart fast-transcription and joins combinedPhrases', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ combinedPhrases: [{ text: 'Hello there.' }, { text: 'How are you?' }] }),
    )
    const out = await transcribeAudio(audioBlob(), CONFIGURED)
    expect(out).toBe('Hello there. How are you?')

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    // URL: endpoint (trailing slash stripped) + fast-transcription path + api-version.
    expect(url).toBe(
      'https://eastus.api.cognitive.microsoft.com/speechtotext/transcriptions:transcribe?api-version=2025-10-15',
    )
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['Ocp-Apim-Subscription-Key']).toBe('speech-key')
    // Body is FormData carrying the audio + the enhanced-mode definition.
    const body = init.body as FormData
    expect(body).toBeInstanceOf(FormData)
    expect(body.get('audio')).toBeInstanceOf(Blob)
    const definition = JSON.parse(String(body.get('definition')))
    expect(definition).toEqual({
      enhancedMode: { enabled: true, model: 'mai-transcribe-1.5', transcribeStyle: 'verbatim' },
    })
  })

  it('falls back to phrases[] when combinedPhrases is absent', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ phrases: [{ text: 'one' }, { text: 'two' }] }),
    )
    expect(await transcribeAudio(audioBlob(), CONFIGURED)).toBe('one two')
  })

  it('maps a non-2xx response to a typed error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('rate limited', { status: 429 }),
    )
    await expect(transcribeAudio(audioBlob(), CONFIGURED)).rejects.toMatchObject({
      code: 'AI_RATE_LIMIT',
    })
  })

  it('maps a 5xx response to AI_UNAVAILABLE', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('boom', { status: 503 }))
    await expect(transcribeAudio(audioBlob(), CONFIGURED)).rejects.toMatchObject({
      code: 'AI_UNAVAILABLE',
    })
  })

  it('returns an empty string (success, not an error) for a silent / no-speech clip', async () => {
    // An empty transcript is a VALID success: a near-silent clip has nothing to
    // transcribe. The client treats '' as a benign no-op.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ combinedPhrases: [{ text: '' }] }))
    expect(await transcribeAudio(audioBlob(), CONFIGURED)).toBe('')
  })
})
