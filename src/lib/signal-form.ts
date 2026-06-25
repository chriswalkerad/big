// Pure, testable logic for the signal admin form (create + edit). Kept free of
// React so validation and the draft → SignalDef mapping can be unit-tested in
// isolation. The form component (src/components/signal-form.tsx) and the admin
// page (src/app/settings/signals/page.tsx) drive these helpers.

import type { SignalDef, SignalMode } from '@/types'

/** Editable shape the form binds to. Threshold is a string while typing. */
export interface SignalFormValues {
  name: string
  prompt: string
  /** Raw input value; parsed/validated into a 0–100 integer on submit. */
  threshold: string
  mode: SignalMode
}

/** Per-field validation messages. A field is valid when its key is absent. */
export type SignalFormErrors = Partial<Record<keyof SignalFormValues, string>>

export const THRESHOLD_MIN = 0
export const THRESHOLD_MAX = 100

export const SIGNAL_MODES: SignalMode[] = ['inline', 'doc']

export const SIGNAL_MODE_LABELS: Record<SignalMode, string> = {
  inline: 'Inline',
  doc: 'Document',
}

/** A blank draft for "New Signal" (create mode). */
export function emptySignalForm(): SignalFormValues {
  return { name: '', prompt: '', threshold: '70', mode: 'inline' }
}

/** Pre-fill the form from an existing signal (edit mode). */
export function signalToForm(signal: SignalDef): SignalFormValues {
  return {
    name: signal.name,
    prompt: signal.prompt,
    threshold: String(signal.threshold),
    mode: signal.mode,
  }
}

/** True when `mode` is one of the allowed signal modes. */
export function isSignalMode(value: string): value is SignalMode {
  return (SIGNAL_MODES as string[]).includes(value)
}

/**
 * Validate a draft. Returns a per-field error map (empty when valid). Name and
 * prompt must be non-empty; threshold must parse to an integer in [0, 100]; mode
 * must be a known mode.
 */
export function validateSignalForm(values: SignalFormValues): SignalFormErrors {
  const errors: SignalFormErrors = {}

  if (!values.name.trim()) {
    errors.name = 'Name is required.'
  }

  if (!values.prompt.trim()) {
    errors.prompt = 'Prompt is required.'
  }

  const threshold = values.threshold.trim()
  if (!threshold) {
    errors.threshold = 'Threshold is required.'
  } else if (!/^-?\d+$/.test(threshold)) {
    errors.threshold = 'Threshold must be a whole number.'
  } else {
    const n = Number(threshold)
    if (n < THRESHOLD_MIN || n > THRESHOLD_MAX) {
      errors.threshold = `Threshold must be between ${THRESHOLD_MIN} and ${THRESHOLD_MAX}.`
    }
  }

  if (!isSignalMode(values.mode)) {
    errors.mode = 'Pick a mode.'
  }

  return errors
}

/** True when a draft has no validation errors. */
export function isSignalFormValid(values: SignalFormValues): boolean {
  return Object.keys(validateSignalForm(values)).length === 0
}

/**
 * Build a slug-ish id from a name (lowercase, hyphenated). Falls back to
 * "signal" when the name has no usable characters, so the id is never empty.
 */
export function slugifySignalId(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'signal'
}

/**
 * Pick an id for a NEW signal that does not collide with `existingIds`. Derives
 * a slug from the name and, on collision, appends `-2`, `-3`, … so each created
 * signal is addressable in storage.
 */
export function nextSignalId(name: string, existingIds: readonly string[]): string {
  const base = slugifySignalId(name)
  if (!existingIds.includes(base)) return base
  let n = 2
  while (existingIds.includes(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}

export interface ToSignalDefOptions {
  /** When editing, the id to preserve. Omit to mint a new one from the name. */
  id?: string
  /** Existing signal ids, used to avoid collisions when minting a new id. */
  existingIds?: readonly string[]
}

/**
 * Map a validated draft to a `SignalDef`. Throws if the draft is invalid, so
 * callers must `validateSignalForm` (or rely on the form gating Save) first.
 * In edit mode pass `id` to keep the same record; in create mode pass
 * `existingIds` so a fresh, collision-free id is generated from the name.
 */
export function toSignalDef(values: SignalFormValues, options: ToSignalDefOptions = {}): SignalDef {
  const errors = validateSignalForm(values)
  if (Object.keys(errors).length > 0) {
    throw new Error('Cannot build a SignalDef from an invalid form.')
  }

  const id =
    options.id ?? nextSignalId(values.name, options.existingIds ?? [])

  return {
    id,
    name: values.name.trim(),
    prompt: values.prompt.trim(),
    threshold: Number(values.threshold.trim()),
    mode: values.mode,
  }
}
