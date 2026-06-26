// /api/transcribe — Azure speech-to-text for voice dictation. Like /api/apply, its
// job is to keep the provider keys off the client.
//   POST: accepts multipart/form-data with an `audio` file, returns the transcript
//         as a typed TranscribeResponse. Delegates to handleTranscribe (testable
//         core). Stores nothing.
//   GET:  returns { available: boolean } so the UI can decide whether to show the
//         mic affordance, without leaking any key material.
//
// Next 16 route-handler convention (per node_modules/next/dist/docs/01-app/
// 03-api-reference/03-file-conventions/route.md): export an async function named
// after the HTTP method that takes the Web `Request` and returns a `Response`; read
// a multipart body with `await request.formData()` and reply with `Response.json`.

import type { TranscribeAvailability } from '@/types'
import { appError } from '@/lib/errors'
import { hasTranscribeConfig } from '@/lib/providers/select'
import { handleTranscribe } from './handler'

// The OpenAI SDK and process.env need the Node.js runtime, not the edge runtime.
export const runtime = 'nodejs'
// Always run per-request; nothing here is cacheable.
export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  let form: FormData
  try {
    form = await request.formData()
  } catch (e) {
    // Malformed / non-multipart body — return a typed error, never throw.
    return Response.json(
      { ok: false, error: appError('UNKNOWN', 'Request body was not valid form data.', e) },
      { status: 400 },
    )
  }

  const result = await handleTranscribe(form)
  return Response.json(result)
}

export function GET(): Response {
  const body: TranscribeAvailability = { available: hasTranscribeConfig() }
  return Response.json(body)
}
