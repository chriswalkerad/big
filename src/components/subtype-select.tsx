'use client'

import type { TextSubtype } from '@/types'
import { cn } from '@/lib/utils'
import { SUBTYPE_LABELS, SUBTYPE_ORDER } from '@/components/subtype-chip'

interface SubtypeSelectProps {
  value: TextSubtype
  /** A manual change flips the doc's subtypeSource to 'user'. */
  onChange: (subtype: TextSubtype) => void
  disabled?: boolean
  className?: string
}

/**
 * Subtype dropdown offering all five subtypes (via SUBTYPE_ORDER). A user selection
 * is what flips `subtypeSource` to 'user' upstream, locking the AI out of overriding
 * it on later submits.
 */
export function SubtypeSelect({ value, onChange, disabled, className }: SubtypeSelectProps) {
  return (
    <label className={cn('inline-flex items-center', className)}>
      <span className="sr-only">Subtype</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as TextSubtype)}
        aria-label="Subtype"
        className={cn(
          'h-8 rounded-pill border border-border bg-surface px-2.5 text-label-xs uppercase text-text-tertiary',
          'transition-colors hover:bg-panel disabled:cursor-not-allowed disabled:opacity-60',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        )}
      >
        {SUBTYPE_ORDER.map((subtype) => (
          <option key={subtype} value={subtype}>
            {SUBTYPE_LABELS[subtype]}
          </option>
        ))}
      </select>
    </label>
  )
}
