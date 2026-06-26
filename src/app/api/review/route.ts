// POST /api/review — keeps the Azure API key off the client. It parses the JSON
// body, delegates to handleReview (the testable core), and serializes the typed
// ReviewResponse. It stores nothing.
//
// Next 16 route-handler convention: export an async function named after the HTTP
// method that takes the Web `Request` and returns a `Response`; read the body with
// `await request.json()` and reply with `Response.json(...)`.

import { appError } from '@/lib/errors'
import { handleReview } from './handler'

// The Azure/OpenAI SDK and process.env need the Node.js runtime, not the edge runtime.
export const runtime = 'nodejs'
// Always run per-request; nothing here is cacheable.
export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch (e) {
    // Malformed/absent JSON body — return a typed error, never throw.
    return Response.json(
      { ok: false, error: appError('UNKNOWN', 'Request body was not valid JSON.', e) },
      { status: 400 },
    )
  }

  const result = await handleReview(body)
  return Response.json(result)
}
