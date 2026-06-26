// Core logic for POST /api/transcribe, factored out of the Next route handler so it
// can be unit-tested directly (the route stays a thin Web Request/Response wrapper).
// It pulls the audio file out of the multipart form, validates presence + a size
// cap, short-circuits when speech-to-text is unconfigured, runs the Azure
// transcription, and always returns a typed TranscribeResponse — it never throws.
// Mirrors api/apply/handler.ts. Transcription is AZURE-ONLY.

import type { TranscribeResponse } from '@/types'
import { appError, toAppError } from '@/lib/errors'
import { transcribeAudio as defaultTranscribeAudio } from '@/lib/providers/azure'
import { hasTranscribeConfig, type TranscribeEnv } from '@/lib/providers/select'

/** Hard cap on the uploaded clip. Voice dictation is short; reject anything huge
 * before it reaches the provider. 25 MB matches the OpenAI audio upload limit. */
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024

/** The multipart field name the client uses for the audio blob. */
export const AUDIO_FIELD = 'audio'

export interface HandleTranscribeDeps {
  env?: TranscribeEnv
  /** Inject the transcriber (tests). Defaults to the real Azure call. */
  transcribeAudio?: (audio: Blob | File, env?: TranscribeEnv) => Promise<string>
}

/**
 * Transcribe an uploaded audio clip from an already-parsed FormData. Returns a
 * discriminated TranscribeResponse; callers serialize it as JSON. Never throws.
 */
export async function handleTranscribe(
  form: FormData,
  deps: HandleTranscribeDeps = {},
): Promise<TranscribeResponse> {
  const env = deps.env ?? process.env
  const transcribe = deps.transcribeAudio ?? defaultTranscribeAudio

  // 1. The audio field must be present and a Blob/File (not a plain string).
  const audio = form.get(AUDIO_FIELD)
  if (audio === null || typeof audio === 'string') {
    return { ok: false, error: appError('UNKNOWN', 'No audio file was provided.') }
  }

  // 2. Reject empty or oversized clips before any provider call.
  if (audio.size === 0) {
    return { ok: false, error: appError('UNKNOWN', 'The audio file was empty.') }
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return { ok: false, error: appError('UNKNOWN', 'The audio file is too large.') }
  }

  // 3. Speech-to-text is Azure-only and has no mock fallback. If it isn't
  // configured, surface a typed AI_UNAVAILABLE rather than attempting a call.
  if (!hasTranscribeConfig(env)) {
    return {
      ok: false,
      error: appError('AI_UNAVAILABLE', 'Voice transcription is not configured.'),
    }
  }

  // 4. Transcribe.
  let text: string
  try {
    text = await transcribe(audio, env)
  } catch (e) {
    return { ok: false, error: toAppError(e) }
  }

  // 5. Guard against an empty transcript slipping through.
  if (text.trim().length === 0) {
    return {
      ok: false,
      error: appError('AI_BAD_JSON', 'The transcription came back empty.'),
    }
  }

  return { ok: true, data: { text } }
}
