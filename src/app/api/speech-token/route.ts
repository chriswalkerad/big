// /api/speech-token — mints a SHORT-LIVED token for the Azure real-time Speech
// SDK (client-side WebSocket streaming dictation). Like /api/transcribe, its job
// is to keep the provider key off the client: the SDK authenticates with this
// token + region, never the subscription key.
//   GET: mints a token, returning a typed SpeechTokenResponse. Delegates to
//        handleSpeechToken (testable core). A failed mint doubles as the UI
//        availability probe. Stores nothing.
//
// Next 16 route-handler convention (per node_modules/next/dist/docs/01-app/
// 03-api-reference/03-file-conventions/route.md): export an async function named
// after the HTTP method that takes the Web `Request` and returns a `Response`.

import { handleSpeechToken } from './handler'

// fetch + process.env need the Node.js runtime, not the edge runtime.
export const runtime = 'nodejs'
// Always run per-request: a freshly minted token must never be cached.
export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  const result = await handleSpeechToken()
  return Response.json(result)
}
