// Client-side wrapper for GET /api/speech-token (streaming voice dictation). Keeps
// fetch/parse/error-mapping out of the UI and returns the same discriminated
// SpeechTokenResponse the route emits, so callers branch on `result.ok`. Never
// throws — network and parse failures are mapped to typed AppErrors. The token
// it returns is short-lived; the subscription key never leaves the server.

import type { SpeechTokenResponse } from '@/types'
import { isAppError, toAppError } from '@/lib/errors'

/**
 * Request a short-lived Azure Speech token for the real-time SDK. Returns
 * `{ ok: true, data: { token, region } }` on success or `{ ok: false, error }`
 * for any failure (HTTP, network, or malformed JSON).
 */
export async function requestSpeechToken(fetchImpl?: typeof fetch): Promise<SpeechTokenResponse> {
  const doFetch = fetchImpl ?? fetch

  let response: Response
  try {
    response = await doFetch('/api/speech-token', { method: 'GET' })
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

  // The route always returns a SpeechTokenResponse shape (even on non-2xx). Trust
  // it when well-formed; otherwise fall back to a typed error from the status.
  if (isSpeechTokenResponse(json)) return json
  return {
    ok: false,
    error: toAppError(new Error(`Speech token request failed (${response.status}).`)),
  }
}

/**
 * Whether streaming speech is available on the server: true when a token mint
 * succeeds. Used for the UI capability check. Never throws — any failure (HTTP,
 * network, parse) reports unavailable.
 */
export async function getSpeechAvailable(fetchImpl?: typeof fetch): Promise<boolean> {
  const result = await requestSpeechToken(fetchImpl)
  return result.ok
}

function isSpeechTokenResponse(value: unknown): value is SpeechTokenResponse {
  if (typeof value !== 'object' || value === null || !('ok' in value)) return false
  const ok = (value as { ok: unknown }).ok
  if (ok === true) {
    if (!('data' in value)) return false
    const data = (value as { data: unknown }).data
    return (
      typeof data === 'object' &&
      data !== null &&
      'token' in data &&
      typeof (data as { token: unknown }).token === 'string' &&
      'region' in data &&
      typeof (data as { region: unknown }).region === 'string'
    )
  }
  if (ok === false) return 'error' in value && isAppError((value as { error: unknown }).error)
  return false
}
