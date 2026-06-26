'use client'

import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Menu, MenuItem } from '@/components/menu'

export type SelectVariant = 'bordered' | 'bare'

export interface SelectOption<T extends string> {
  value: T
  label: string
  disabled?: boolean
}

interface SelectProps<T extends string> {
  /** The currently selected value, or `null` for an unset/placeholder state. */
  value: T | null
  /** Fired with the chosen option's value. */
  onChange: (value: T) => void
  options: SelectOption<T>[]
  /** `bordered` (default) is a control with a border/bg; `bare` is inline text-only. */
  variant?: SelectVariant
  /** Muted text shown in the trigger when `value` is `null`. */
  placeholder?: string
  /** Accessible name for the trigger. */
  ariaLabel?: string
  /** Align the panel to the trigger's left (default) or right edge. */
  align?: 'left' | 'right'
  disabled?: boolean
  /** Extra classes on the trigger. */
  triggerClassName?: string
}

const triggerVariants: Record<SelectVariant, string> = {
  bordered: cn(
    'h-9 gap-2 rounded-control border border-border bg-surface px-2.5 text-label-sm',
    'transition-colors hover:bg-panel',
  ),
  bare: cn(
    'gap-1 rounded-control border border-transparent bg-transparent px-1 py-0.5 text-label-sm',
    'transition-colors hover:text-text-primary',
  ),
}

/**
 * Shared accessible dropdown built on the `Menu` primitive — the app-wide replacement
 * for native `<select>`. The trigger shows the selected option's label (or a muted
 * `placeholder` when `value` is `null`) and a chevron; the panel lists options as
 * menuitems with a check on the selected one. Disabled options are non-selectable.
 * Keyboard roving focus, Escape, outside-click, and type-ahead come from `Menu`.
 */
export function Select<T extends string>({
  value,
  onChange,
  options,
  variant = 'bordered',
  placeholder = 'Select…',
  ariaLabel,
  align = 'left',
  disabled,
  triggerClassName,
}: SelectProps<T>) {
  const selected = value !== null ? options.find((o) => o.value === value) ?? null : null
  const hasValue = selected !== null

  return (
    <Menu
      align={align}
      disabled={disabled}
      ariaLabel={ariaLabel}
      triggerClassName={cn(
        'inline-flex items-center justify-between',
        'text-text-secondary',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
        'disabled:cursor-not-allowed disabled:opacity-60',
        triggerVariants[variant],
        triggerClassName,
      )}
      label={
        <>
          <span className={cn('truncate', hasValue ? 'text-text-primary' : 'text-text-tertiary')}>
            {hasValue ? selected.label : placeholder}
          </span>
          <ChevronDown className="size-3.5 shrink-0 text-text-tertiary" aria-hidden="true" />
        </>
      }
    >
      {(close) => (
        <div className="max-w-[min(16rem,calc(100vw-2rem))]">
          {options.map((option) => {
            const isSelected = option.value === value
            return (
              <MenuItem
                key={option.value}
                selected={isSelected}
                disabled={option.disabled}
                onClick={() => {
                  onChange(option.value)
                  close()
                }}
              >
                <span className="truncate">{option.label}</span>
                {isSelected ? (
                  <Check className="size-3.5 shrink-0" aria-hidden="true" />
                ) : null}
              </MenuItem>
            )
          })}
        </div>
      )}
    </Menu>
  )
}
