// Core logic for GET /api/speech-token, factored out of the Next route handler so
// it can be unit-tested directly (the route stays a thin Web Request/Response
// wrapper). It mints a SHORT-LIVED token for the Azure real-time Speech SDK: the
// SDK streams audio over a WebSocket authenticated with this token + the region,
// never the subscription key. The key stays server-side here — the client only
// ever receives the token. Always returns a typed SpeechTokenResponse; never
// throws. Mirrors api/transcribe/handler.ts. Speech is AZURE-ONLY.

import type { SpeechTokenResponse } from '@/types'
import { appError, toAppError } from '@/lib/errors'
import {
  hasSpeechTokenConfig,
  resolveTranscribeConfig,
  type TranscribeEnv,
} from '@/lib/providers/select'

/** The issueToken endpoint responds well within a second; cap it so a hung
 * upstream surfaces as a typed AI_TIMEOUT instead of holding the request open. */
export const TOKEN_TIMEOUT_MS = 10_000

export interface HandleSpeechTokenDeps {
  env?: TranscribeEnv
  /** Inject fetch (tests). Defaults to the global. */
  fetchImpl?: typeof fetch
}

/**
 * Mint a short-lived Azure Speech token. Returns a discriminated
 * SpeechTokenResponse; callers serialize it as JSON. Never throws. A failed mint
 * doubles as the "unavailable" signal for the UI capability probe.
 */
export async function handleSpeechToken(
  deps: HandleSpeechTokenDeps = {},
): Promise<SpeechTokenResponse> {
  const env = deps.env ?? process.env
  const doFetch = deps.fetchImpl ?? fetch

  // 1. Streaming is Azure-only and has no mock fallback. If endpoint/key/region
  // aren't all set, surface a typed AI_UNAVAILABLE rather than attempting a call.
  if (!hasSpeechTokenConfig(env)) {
    return {
      ok: false,
      error: appError('AI_UNAVAILABLE', 'Streaming voice dictation is not configured.'),
    }
  }

  const { endpoint, apiKey, region } = resolveTranscribeConfig(env)
  // Build the issueToken URL off the resolved endpoint (no trailing slash).
  const base = endpoint.replace(/\/+$/, '')
  const url = `${base}/sts/v1.0/issueToken`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TOKEN_TIMEOUT_MS)
  let res: Response
  try {
    res = await doFetch(url, {
      method: 'POST',
      // The subscription key authenticates THIS server-side mint only; it is never
      // forwarded to the client. An empty body is required by issueToken.
      headers: { 'Ocp-Apim-Subscription-Key': apiKey },
      body: '',
      signal: controller.signal,
    })
  } catch (e) {
    // AbortError -> AI_TIMEOUT, offline -> NETWORK_OFFLINE, AppErrors pass through.
    return { ok: false, error: toAppError(e) }
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    // Read the body best-effort for context; status drives the error mapping.
    const detail = await res.text().catch(() => '')
    return {
      ok: false,
      error: appError(
        res.status === 429
          ? 'AI_RATE_LIMIT'
          : res.status >= 500 && res.status <= 599
            ? 'AI_UNAVAILABLE'
            : 'UNKNOWN',
        `Speech token request failed (HTTP ${res.status}).${detail ? ` ${detail}` : ''}`,
      ),
    }
  }

  // On 2xx the body IS the token (text/plain), not JSON.
  let token: string
  try {
    token = (await res.text()).trim()
  } catch (e) {
    return { ok: false, error: toAppError(e) }
  }
  if (!token) {
    return {
      ok: false,
      error: appError('AI_UNAVAILABLE', 'Speech token request returned an empty token.'),
    }
  }

  return { ok: true, data: { token, region } }
}
