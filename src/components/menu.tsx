'use client'

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Popover semantics. `menu` is the action-list pattern (role="menu" / "menuitem",
 * `aria-haspopup="menu"`). `listbox` is the value-picker pattern (role="listbox" /
 * "option", `aria-haspopup="listbox"`) used by `Select`. Keyboard nav (arrows, Home,
 * End, Escape, type-ahead) and focus management are identical for both.
 */
export type MenuVariant = 'menu' | 'listbox'

const ITEM_ROLE: Record<MenuVariant, string> = {
  menu: 'menuitem',
  listbox: 'option',
}

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
  /** Popover semantics: action `menu` (default) or value-picker `listbox`. */
  variant?: MenuVariant
  /** Forwarded to the trigger so callers can wire form/error semantics. */
  'aria-invalid'?: boolean
  'aria-describedby'?: string
  'aria-labelledby'?: string
}

/**
 * Minimal accessible popover: a trigger button that toggles a panel, closing on
 * outside click or Escape. Backs both the action `Menu` (the ⋯ overflow, project
 * switcher, reviewer-status, inbox) and the `Select` value picker via `variant`.
 * The `children` render-prop receives a `close` callback so items can dismiss the
 * popover after acting; focus returns to the trigger on activation (WAI-ARIA).
 */
export function Menu({
  label,
  children,
  triggerClassName,
  ariaLabel,
  disabled,
  align = 'right',
  variant = 'menu',
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedby,
  'aria-labelledby': ariaLabelledby,
}: MenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const panelId = useId()
  const itemRole = ITEM_ROLE[variant]

  // The enabled, focusable items inside the open panel (buttons or links acting as
  // menuitems/options). aria-disabled items are skipped so roving focus lands on
  // actionable rows.
  const getItems = useCallback((): HTMLElement[] => {
    const panel = panelRef.current
    if (!panel) return []
    return Array.from(panel.querySelectorAll<HTMLElement>(`[role="${itemRole}"]`)).filter(
      (el) => el.getAttribute('aria-disabled') !== 'true' && !el.hasAttribute('disabled'),
    )
  }, [itemRole])

  // On open, move focus to the selected item if any, else the first — so the popover is
  // operable from the keyboard (listbox opens on the current value per WAI-ARIA).
  useEffect(() => {
    if (!open) return
    const items = getItems()
    const selected = items.find((el) => el.getAttribute('aria-selected') === 'true')
    ;(selected ?? items[0])?.focus()
  }, [open, getItems])

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

  // Tracks that an in-panel activation requested a close, so focus should return to the
  // trigger once the panel unmounts (WCAG 2.4.3 / WAI-ARIA menu pattern). It is set by the
  // panel's own click handler — a real DOM event, never render — so `close` stays ref-free
  // and the render-time `children(close)` render-prop never touches a ref.
  const closeRequested = useRef(false)

  // `close` only flips `open`; it touches no refs/DOM.
  const close = useCallback(() => setOpen(false), [])

  // After the panel unmounts, return focus to the trigger — but only if the close left
  // focus orphaned on <body>. A link item that navigated (or anything that moved focus)
  // keeps it, so we never steal focus from a navigation.
  useEffect(() => {
    if (open) return
    if (!closeRequested.current) return
    closeRequested.current = false
    const active = document.activeElement
    if (active === null || active === document.body) triggerRef.current?.focus()
  }, [open])

  // Arrow-key roving focus across items, plus Home/End. Activation (Enter/Space) is
  // handled natively by the underlying button/link element.
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
      // Tabbing out closes the popover (no trap) and lets focus continue naturally.
      setOpen(false)
    } else if (e.key.length === 1 && /\S/.test(e.key)) {
      // Type-ahead: jump to the next item whose text starts with the typed character.
      const char = e.key.toLowerCase()
      const start = currentIndex < 0 ? 0 : currentIndex + 1
      const ordered = [...items.slice(start), ...items.slice(0, start)]
      const match = ordered.find((el) => (el.textContent ?? '').trim().toLowerCase().startsWith(char))
      if (match) {
        e.preventDefault()
        match.focus()
      }
    }
  }

  // Validity/description/label associations forwarded to the trigger. Spread (rather than
  // written as literal JSX attrs) so the stale `role-supports-aria-props` allowlist — which
  // wrongly omits aria-invalid for buttons (it's valid per ARIA 1.2) — doesn't misfire.
  const triggerAria = {
    'aria-invalid': ariaInvalid,
    'aria-describedby': ariaDescribedby,
    'aria-labelledby': ariaLabelledby,
  }

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup={variant}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={ariaLabel}
        {...triggerAria}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          // Down/Up open the popover and focus the first/selected item (native pattern).
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
          role={variant}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledby}
          onKeyDown={onPanelKeyDown}
          // Bubbles after an item's own onClick (which typically calls `close`); record
          // that the close came from an in-panel activation so focus returns to the
          // trigger once the panel unmounts.
          onClick={(e) => {
            if ((e.target as Element).closest(`[role="${itemRole}"]`)) {
              closeRequested.current = true
            }
          }}
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
  /**
   * Row semantics. `menuitem` (default) for action menus; `option` for the `listbox`
   * value picker, where `selected` is surfaced as `aria-selected` for screen readers.
   */
  role?: 'menuitem' | 'option'
}

/** A single popover row. Marked `aria-disabled` when not a legal action. */
export function MenuItem({ onClick, children, selected, disabled, role = 'menuitem' }: MenuItemProps) {
  const isOption = role === 'option'
  return (
    <button
      type="button"
      role={role}
      disabled={disabled}
      aria-disabled={disabled}
      // Options expose selection to AT; menuitems use data-selected for styling only.
      aria-selected={isOption ? Boolean(selected) : undefined}
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
