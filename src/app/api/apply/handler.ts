// Core logic for POST /api/apply, factored out of the Next route handler so it can
// be unit-tested directly (the route stays a thin Web Request/Response wrapper). It
// validates the request body, short-circuits empty text, runs the selected provider's
// applyEdit, and always returns a typed ApplyResponse — it never throws. Mirrors
// api/review/handler.ts.

import type { ApplyResponse } from '@/types'
import { appError, toAppError } from '@/lib/errors'
import { applyRequestSchema } from '@/lib/schemas'
import type { ReviewProvider } from '@/lib/providers/interface'
import { type ProviderEnv, selectProvider } from '@/lib/providers/select'

export interface HandleApplyDeps {
  env?: ProviderEnv
  /** Inject a provider (tests). Defaults to env-based selection. */
  provider?: ReviewProvider
}

/**
 * Apply an instruction-driven rewrite for an already-parsed request body. Returns a
 * discriminated ApplyResponse; callers serialize it as JSON. Never throws.
 */
export async function handleApply(body: unknown, deps: HandleApplyDeps = {}): Promise<ApplyResponse> {
  // 1. Validate the request body.
  const parsedRequest = applyRequestSchema.safeParse(body)
  if (!parsedRequest.success) {
    return {
      ok: false,
      error: appError('UNKNOWN', 'Invalid apply request.', parsedRequest.error.issues),
    }
  }
  const input = parsedRequest.data

  // 2. Whitespace-only text is a user error, not a provider call.
  if (input.text.trim().length === 0) {
    return { ok: false, error: appError('EMPTY_DOC') }
  }

  // 3. Select and run the provider.
  let text: string
  try {
    const provider = deps.provider ?? selectProvider(deps.env ?? process.env)
    text = await provider.applyEdit(input)
  } catch (e) {
    return { ok: false, error: toAppError(e) }
  }

  // 4. Guard against an empty rewrite slipping through.
  if (text.trim().length === 0) {
    return {
      ok: false,
      error: appError('AI_BAD_JSON', 'The model returned an empty rewrite.'),
    }
  }

  return { ok: true, data: { text } }
}
