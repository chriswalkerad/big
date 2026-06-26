// Client-side wrapper for /api/transcribe (voice dictation). Keeps fetch/parse/
// error-mapping out of the UI and returns the same discriminated TranscribeResponse
// the route emits, so callers branch on `result.ok`. Never throws — network and
// parse failures are mapped to typed AppErrors. Mirrors apply-client.ts.

import type { TranscribeResponse } from '@/types'
import { isAppError, toAppError } from '@/lib/errors'
import { AUDIO_FIELD } from '@/app/api/transcribe/handler'

export interface RequestTranscribeArgs {
  audio: Blob
  /** Inject fetch for tests; defaults to the global. */
  fetchImpl?: typeof fetch
  signal?: AbortSignal
}

/**
 * Submit a recorded audio clip for transcription. Returns `{ ok: true, data }` on
 * success or `{ ok: false, error }` for any failure (HTTP, network, or malformed
 * JSON). Posts as multipart/form-data under the `audio` field.
 */
export async function requestTranscribe(
  audio: Blob,
  args: Omit<RequestTranscribeArgs, 'audio'> = {},
): Promise<TranscribeResponse> {
  const doFetch = args.fetchImpl ?? fetch
  const form = new FormData()
  // Name the part so the server/provider can sniff the format (webm/opus).
  form.append(AUDIO_FIELD, audio, 'audio.webm')

  let response: Response
  try {
    response = await doFetch('/api/transcribe', {
      method: 'POST',
      body: form,
      signal: args.signal,
    })
  } catch (e) {
    // Network failure / abort before any response.
    return { ok: false, error: toAppError(e) }
  }

  let json: unknown
  try {
    json = await response.json()
  } catch (e) {
    return { ok: false, error: toAppError(e) }
  }

  // The route always returns a TranscribeResponse shape (even on non-2xx). Trust it
  // when it is well-formed; otherwise fall back to a typed error from the status.
  if (isTranscribeResponse(json)) return json
  return { ok: false, error: toAppError(new Error(`Transcription failed (${response.status}).`)) }
}

/**
 * Whether speech-to-text is configured on the server, via GET /api/transcribe. Used
 * for the UI capability check. Never throws — any failure reports unavailable.
 */
export async function getTranscribeAvailable(fetchImpl?: typeof fetch): Promise<boolean> {
  const doFetch = fetchImpl ?? fetch
  try {
    const response = await doFetch('/api/transcribe', { method: 'GET' })
    const json: unknown = await response.json()
    return (
      typeof json === 'object' &&
      json !== null &&
      'available' in json &&
      (json as { available: unknown }).available === true
    )
  } catch {
    return false
  }
}

function isTranscribeResponse(value: unknown): value is TranscribeResponse {
  if (typeof value !== 'object' || value === null || !('ok' in value)) return false
  const ok = (value as { ok: unknown }).ok
  if (ok === true) {
    if (!('data' in value)) return false
    const data = (value as { data: unknown }).data
    return (
      typeof data === 'object' &&
      data !== null &&
      'text' in data &&
      typeof (data as { text: unknown }).text === 'string'
    )
  }
  if (ok === false) return 'error' in value && isAppError((value as { error: unknown }).error)
  return false
}
