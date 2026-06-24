'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface MenuProps {
  /** The trigger button content. */
  label: ReactNode
  /** Menu contents (typically MenuItem buttons). Receives a `close` callback. */
  children: (close: () => void) => ReactNode
  /** Extra classes on the trigger. */
  triggerClassName?: string
  /** Accessible name for the trigger when the label is not text. */
  ariaLabel?: string
  disabled?: boolean
  /** Align the panel to the trigger's right edge (default) or left. */
  align?: 'left' | 'right'
}

/**
 * Minimal accessible popover menu: a trigger button that toggles a panel, closing on
 * outside click or Escape. Used for the status control and the routing/destination
 * picker. The `children` render-prop receives a `close` callback so items can dismiss
 * the menu after acting.
 */
export function Menu({
  label,
  children,
  triggerClassName,
  ariaLabel,
  disabled,
  align = 'right',
}: MenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const close = () => setOpen(false)

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={triggerClassName}
      >
        {label}
      </button>
      {open ? (
        <div
          id={panelId}
          role="menu"
          className={cn(
            'absolute top-full z-50 mt-1.5 min-w-44 overflow-hidden rounded-card border border-border bg-surface p-1 shadow-lg',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {children(close)}
        </div>
      ) : null}
    </div>
  )
}

interface MenuItemProps {
  onClick: () => void
  children: ReactNode
  selected?: boolean
  disabled?: boolean
}

/** A single menu row. Marked `aria-disabled` when not a legal action. */
export function MenuItem({ onClick, children, selected, disabled }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      aria-disabled={disabled}
      data-selected={selected ? 'true' : undefined}
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between gap-2 rounded-control px-2.5 py-1.5 text-left text-label-sm transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        disabled
          ? 'cursor-not-allowed text-text-tertiary'
          : 'text-text-secondary hover:bg-panel hover:text-text-primary',
        selected ? 'text-text-primary' : '',
      )}
    >
      {children}
    </button>
  )
}
