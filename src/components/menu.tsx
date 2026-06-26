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
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const panelId = useId()

  // The enabled, focusable items inside the open panel (buttons or links acting as
  // menuitems). aria-disabled items are skipped so roving focus lands on actionable rows.
  const getItems = (): HTMLElement[] => {
    const panel = panelRef.current
    if (!panel) return []
    return Array.from(
      panel.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ).filter((el) => el.getAttribute('aria-disabled') !== 'true' && !el.hasAttribute('disabled'))
  }

  // On open, move focus to the first item so the menu is operable from the keyboard.
  useEffect(() => {
    if (!open) return
    const items = getItems()
    items[0]?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        // Escape returns focus to the trigger (WCAG 2.1.2 / menu pattern).
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const close = () => setOpen(false)

  // Arrow-key roving focus across menu items, plus Home/End. Activation (Enter/Space)
  // is handled natively by the underlying button/link element.
  function onPanelKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const items = getItems()
    if (items.length === 0) return
    const currentIndex = items.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      items[(currentIndex + 1 + items.length) % items.length || 0]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const next = currentIndex <= 0 ? items.length - 1 : currentIndex - 1
      items[next]?.focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      items[0]?.focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      items[items.length - 1]?.focus()
    } else if (e.key === 'Tab') {
      // Tabbing out closes the menu (no trap) and lets focus continue naturally.
      setOpen(false)
    }
  }

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          // Down/Up open the menu and focus the first item (native menu-button pattern).
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault()
            setOpen(true)
          }
        }}
        className={triggerClassName}
      >
        {label}
      </button>
      {open ? (
        <div
          id={panelId}
          ref={panelRef}
          role="menu"
          aria-label={ariaLabel}
          onKeyDown={onPanelKeyDown}
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
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
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
