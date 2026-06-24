'use client'

import { useEffect, type RefObject } from 'react'

/** Elements that can receive keyboard focus inside a dialog. */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function focusableWithin(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  )
}

/**
 * Trap keyboard focus inside a modal dialog while it is open (WCAG 2.1.2 No Keyboard
 * Trap is about *escaping* a widget; a modal must instead keep Tab focus within its
 * own controls and restore focus on close — the modal dialog pattern).
 *
 * While `active`, this:
 *   - moves focus into the container (the first focusable element, or the container
 *     itself if it is programmatically focusable),
 *   - cycles Tab / Shift+Tab within the container's focusable elements,
 *   - restores focus to whatever was focused before opening, on cleanup.
 *
 * Escape handling is left to the caller (each dialog already wires its own close).
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
): void {
  useEffect(() => {
    if (!active) return
    const container = containerRef.current
    if (!container) return

    const previouslyFocused = document.activeElement as HTMLElement | null

    // Move focus inside the dialog.
    const initial = focusableWithin(container)
    if (initial.length > 0) {
      initial[0].focus()
    } else if (container.tabIndex >= 0) {
      container.focus()
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Tab') return
      const focusable = focusableWithin(container as HTMLElement)
      if (focusable.length === 0) {
        // Nothing focusable but the container: keep focus on it.
        event.preventDefault()
        ;(container as HTMLElement).focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const activeEl = document.activeElement

      if (event.shiftKey) {
        if (activeEl === first || !(container as HTMLElement).contains(activeEl)) {
          event.preventDefault()
          last.focus()
        }
      } else if (activeEl === last || !(container as HTMLElement).contains(activeEl)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      // Restore focus to the trigger that opened the dialog.
      previouslyFocused?.focus()
    }
  }, [active, containerRef])
}
