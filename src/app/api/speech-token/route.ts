// /api/speech-token — mints a SHORT-LIVED token for the Azure real-time Speech
// SDK (client-side WebSocket streaming dictation). Its job is to keep the
// provider key off the client: the SDK authenticates with this
// token + region, never the subscription key.
//   GET:  cheap availability probe — returns { available: boolean } from config
//         alone (no token minted, no Azure round-trip), so a doc-page mount can
//         decide whether to show the mic affordance without burning a token mint
//         per render. Leaks no key material.
//   POST: mints a token, returning a typed SpeechTokenResponse over a no-store
//         response. Delegates to handleSpeechToken (testable core). Stores nothing.
//
// Splitting availability (GET) from minting (POST) means the live token is only
// ever produced on an explicit request, and that response is marked no-store so
// browsers/proxies never write it to cache. `dynamic='force-dynamic'` only
// disables Next's render cache, not the HTTP response cache, so the header matters.
//
// Next 16 route-handler convention: export an async function named after the HTTP
// method that takes the Web `Request` and returns a `Response`.

import type { SpeechTokenAvailability } from '@/types'
import { hasSpeechTokenConfig } from '@/lib/providers/select'
import { handleSpeechToken } from './handler'

// fetch + process.env need the Node.js runtime, not the edge runtime.
export const runtime = 'nodejs'
// Always run per-request: a freshly minted token must never be cached.
export const dynamic = 'force-dynamic'

export function GET(): Response {
  // Config-only availability: no token is minted and Azure is never called.
  const body: SpeechTokenAvailability = { available: hasSpeechTokenConfig() }
  return Response.json(body)
}

export async function POST(): Promise<Response> {
  const result = await handleSpeechToken()
  // The minted bearer token is live credential material: forbid every cache layer
  // (HTTP/browser/proxy) from storing or replaying it.
  return Response.json(result, {
    headers: {
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
    },
  })
}
