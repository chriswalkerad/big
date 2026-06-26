import { describe, expect, it, vi } from 'vitest'
import { handleTranscribe, MAX_AUDIO_BYTES, AUDIO_FIELD } from './handler'
import { appError } from '@/lib/errors'
import type { TranscribeEnv } from '@/lib/providers/select'

const CONFIGURED: TranscribeEnv = {
  AZURE_OPENAI_ENDPOINT: 'https://x.services.ai.azure.com/openai/v1',
  AZURE_OPENAI_API_KEY: 'key',
  AZURE_OPENAI_TRANSCRIBE_DEPLOYMENT: 'gpt-4o-transcribe',
}

function formWithAudio(bytes = 16, type = 'audio/webm'): FormData {
  const form = new FormData()
  form.append(AUDIO_FIELD, new Blob([new Uint8Array(bytes)], { type }), 'audio.webm')
  return form
}

describe('handleTranscribe', () => {
  it('happy path: returns ok with the transcript from the injected transcriber', async () => {
    const transcribeAudio = vi.fn<(audio: Blob | File, env?: TranscribeEnv) => Promise<string>>(
      async () => 'hello world',
    )
    const res = await handleTranscribe(formWithAudio(), { env: CONFIGURED, transcribeAudio })
    expect(res).toEqual({ ok: true, data: { text: 'hello world' } })
    expect(transcribeAudio).toHaveBeenCalledOnce()
    // The blob is forwarded along with the env.
    const [audioArg, envArg] = transcribeAudio.mock.calls[0]
    expect(audioArg).toBeInstanceOf(Blob)
    expect(envArg).toBe(CONFIGURED)
  })

  it('returns AI_UNAVAILABLE when transcription is unconfigured', async () => {
    const transcribeAudio = vi.fn(async () => 'should not be called')
    const res = await handleTranscribe(formWithAudio(), { env: {}, transcribeAudio })
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error.code).toBe('AI_UNAVAILABLE')
      expect(res.error.retryable).toBe(true)
    }
    expect(transcribeAudio).not.toHaveBeenCalled()
  })

  it('returns a typed error when the audio field is missing', async () => {
    const res = await handleTranscribe(new FormData(), { env: CONFIGURED })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('UNKNOWN')
  })

  it('returns a typed error when the audio field is a string, not a file', async () => {
    const form = new FormData()
    form.append(AUDIO_FIELD, 'not-a-file')
    const res = await handleTranscribe(form, { env: CONFIGURED })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('UNKNOWN')
  })

  it('returns a typed error for an empty audio clip', async () => {
    const res = await handleTranscribe(formWithAudio(0), { env: CONFIGURED })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('UNKNOWN')
  })

  it('rejects an oversized clip before calling the provider', async () => {
    const transcribeAudio = vi.fn(async () => 'unused')
    const form = new FormData()
    // Lie about size cheaply: a Blob whose size exceeds the cap.
    const big = new Blob([new Uint8Array(MAX_AUDIO_BYTES + 1)], { type: 'audio/webm' })
    form.append(AUDIO_FIELD, big, 'audio.webm')
    const res = await handleTranscribe(form, { env: CONFIGURED, transcribeAudio })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('UNKNOWN')
    expect(transcribeAudio).not.toHaveBeenCalled()
  })

  it('maps a provider that throws to a typed AppError', async () => {
    const transcribeAudio = vi.fn(async () => {
      throw appError('AI_RATE_LIMIT')
    })
    const res = await handleTranscribe(formWithAudio(), { env: CONFIGURED, transcribeAudio })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('AI_RATE_LIMIT')
  })

  it('maps a raw thrown error to a typed AppError', async () => {
    const transcribeAudio = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    const res = await handleTranscribe(formWithAudio(), { env: CONFIGURED, transcribeAudio })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('NETWORK_OFFLINE')
  })

  it('treats an empty transcript as AI_BAD_JSON', async () => {
    const transcribeAudio = vi.fn(async () => '   ')
    const res = await handleTranscribe(formWithAudio(), { env: CONFIGURED, transcribeAudio })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('AI_BAD_JSON')
  })
})
