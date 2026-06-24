// Typed application error model. Endpoints and the storage layer return these
// instead of throwing raw — the UI reads `code` to render a specific reason and
// `retryable` to decide whether to offer a retry. See specs/bsp-backend-build-spec.md.

export type AppErrorCode =
  | 'AI_TIMEOUT'
  | 'AI_BAD_JSON'
  | 'AI_RATE_LIMIT'
  | 'AI_UNAVAILABLE'
  | 'NETWORK_OFFLINE'
  | 'STORAGE_UNAVAILABLE'
  | 'STORAGE_QUOTA'
  | 'DOC_NOT_FOUND'
  | 'EMPTY_DOC'
  | 'UNKNOWN'

export interface AppError {
  code: AppErrorCode
  message: string
  retryable: boolean
  cause?: unknown
}

const RETRYABLE: Record<AppErrorCode, boolean> = {
  AI_TIMEOUT: true,
  AI_BAD_JSON: true,
  AI_RATE_LIMIT: true,
  AI_UNAVAILABLE: true,
  NETWORK_OFFLINE: true,
  STORAGE_UNAVAILABLE: false,
  STORAGE_QUOTA: false,
  DOC_NOT_FOUND: false,
  EMPTY_DOC: false,
  UNKNOWN: false,
}

const DEFAULT_MESSAGE: Record<AppErrorCode, string> = {
  AI_TIMEOUT: 'The review timed out. Try again.',
  AI_BAD_JSON: "Couldn't read the model's response. Try again.",
  AI_RATE_LIMIT: 'Rate limited by the model. Wait a moment and retry.',
  AI_UNAVAILABLE: 'The model is temporarily unavailable. Wait a moment and retry.',
  NETWORK_OFFLINE: "Can't reach the network. Check your connection and retry.",
  STORAGE_UNAVAILABLE: 'Local storage is unavailable; working in memory for now.',
  STORAGE_QUOTA: 'Local storage is full.',
  DOC_NOT_FOUND: 'That document could not be found.',
  EMPTY_DOC: 'Add some text before reviewing.',
  UNKNOWN: 'Something went wrong.',
}

/** Construct a typed AppError, defaulting message and retryable from the code. */
export function appError(code: AppErrorCode, message?: string, cause?: unknown): AppError {
  return {
    code,
    message: message && message.trim() ? message : DEFAULT_MESSAGE[code],
    retryable: RETRYABLE[code],
    cause,
  }
}

export function isAppError(e: unknown): e is AppError {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    'message' in e &&
    'retryable' in e &&
    typeof (e as AppError).retryable === 'boolean'
  )
}

/**
 * Map any thrown/returned value to a typed AppError. Pass-through if it already
 * is one. Detection is by error name, message, and HTTP status so it works across
 * fetch errors, DOMExceptions, SyntaxErrors, and provider failures.
 */
export function toAppError(e: unknown): AppError {
  if (isAppError(e)) return e

  const obj = typeof e === 'object' && e !== null ? (e as Record<string, unknown>) : {}
  const name = String(obj.name ?? '')
  const message = String(obj.message ?? (typeof e === 'string' ? e : ''))
  const statusRaw = obj.status ?? obj.code
  const status = typeof statusRaw === 'number' ? statusRaw : undefined
  const hay = `${name} ${message}`.toLowerCase()

  if (name === 'AbortError' || hay.includes('timeout') || hay.includes('timed out')) {
    return appError('AI_TIMEOUT', message, e)
  }
  if (status === 429 || hay.includes('rate limit') || hay.includes('too many requests') || hay.includes('429')) {
    return appError('AI_RATE_LIMIT', message, e)
  }
  // 5xx and explicit "service unavailable / overloaded / high demand" responses are
  // transient model-side failures — surface them as retryable, not a dead-end UNKNOWN.
  if (
    (typeof status === 'number' && status >= 500 && status <= 599) ||
    hay.includes('unavailable') ||
    hay.includes('overloaded') ||
    hay.includes('high demand')
  ) {
    return appError('AI_UNAVAILABLE', message, e)
  }
  if (name === 'QuotaExceededError' || hay.includes('quota')) {
    return appError('STORAGE_QUOTA', message, e)
  }
  if (
    hay.includes('localstorage') ||
    hay.includes('storage unavailable') ||
    hay.includes('storage is not available') ||
    hay.includes('access is denied for this document')
  ) {
    return appError('STORAGE_UNAVAILABLE', message, e)
  }
  if (name === 'SyntaxError' || hay.includes('json') || hay.includes('unexpected token')) {
    return appError('AI_BAD_JSON', message, e)
  }
  if (
    (name === 'TypeError' && hay.includes('fetch')) ||
    hay.includes('failed to fetch') ||
    hay.includes('network') ||
    hay.includes('offline')
  ) {
    return appError('NETWORK_OFFLINE', message, e)
  }
  return appError('UNKNOWN', message, e)
}
