'use client'

import { useId } from 'react'
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
  /** Forwarded to the trigger for form/error wiring (3.3.1 / 3.3.2). */
  'aria-invalid'?: boolean
  'aria-describedby'?: string
  'aria-labelledby'?: string
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
 * Shared accessible dropdown built on the `Menu` primitive in its `listbox` mode — the
 * app-wide replacement for native `<select>`. The trigger is a value picker
 * (`aria-haspopup="listbox"`, `aria-expanded`) whose accessible name is the selected
 * option's label (or the muted `placeholder` when `value` is `null`); the panel is a
 * `role="listbox"` of `role="option"` rows carrying `aria-selected`, with a check on the
 * selected one. Disabled options are non-selectable. Keyboard roving focus, Escape,
 * outside-click, type-ahead, and focus-return come from `Menu`. `aria-invalid`,
 * `aria-describedby`, and `aria-labelledby` are forwarded to the trigger for form wiring.
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
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedby,
  'aria-labelledby': ariaLabelledby,
}: SelectProps<T>) {
  const selected = value !== null ? options.find((o) => o.value === value) ?? null : null
  const hasValue = selected !== null
  const valueId = useId()
  const labelId = useId()

  // The trigger's accessible name is composed via `aria-labelledby` as "<field> <value>"
  // — the native-select equivalent — so screen readers announce both the field and the
  // current selection (WCAG 4.1.2). The field part is the caller's `aria-labelledby`
  // (e.g. a visible form label) when given, else a visually-hidden node carrying
  // `ariaLabel`. The value part is the trigger's own selected-label/placeholder text.
  const fieldLabelledBy = ariaLabelledby ?? (ariaLabel ? labelId : undefined)
  const labelledBy = cn(fieldLabelledBy, valueId) || undefined

  return (
    <Menu
      variant="listbox"
      align={align}
      disabled={disabled}
      aria-invalid={ariaInvalid}
      aria-describedby={ariaDescribedby}
      aria-labelledby={labelledBy}
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
          {ariaLabel && !ariaLabelledby ? (
            <span id={labelId} className="sr-only">
              {ariaLabel}
            </span>
          ) : null}
          <span
            id={valueId}
            className={cn('truncate', hasValue ? 'text-text-primary' : 'text-text-tertiary')}
          >
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
                role="option"
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
