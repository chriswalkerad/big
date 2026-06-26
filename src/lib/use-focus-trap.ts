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
 * Hide everything *outside* the dialog from assistive tech and pointer/keyboard
 * interaction while it is open (the missing half of the modal dialog pattern:
 * trapping Tab is not enough — VoiceOver/JAWS browse-mode can still read past the
 * dialog into the obscured page). We walk from the dialog up to `<body>` and mark
 * every sibling NOT on the ancestor path as `inert`, which both removes it from
 * the a11y tree and blocks interaction. Returns a cleanup that restores prior
 * state, so dialogs nested inside (or stacked on) each other behave correctly.
 */
function inertSiblingsOutside(container: HTMLElement): () => void {
  const marked: HTMLElement[] = []
  let node: HTMLElement | null = container
  while (node && node !== document.body && node.parentElement) {
    const parent: HTMLElement = node.parentElement
    for (const sibling of Array.from(parent.children)) {
      if (sibling === node || !(sibling instanceof HTMLElement)) continue
      // Skip anything already inert (e.g. an outer dialog's backdrop) so we don't
      // clobber and then prematurely clear a previously-applied trap.
      if (sibling.inert) continue
      sibling.inert = true
      marked.push(sibling)
    }
    node = parent
  }
  return () => {
    for (const el of marked) el.inert = false
  }
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

    // Hide the rest of the page from AT / interaction while the dialog is open.
    const restoreInert = inertSiblingsOutside(container)

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
      // Un-hide the background BEFORE restoring focus, or the fallback anchor
      // (and the original trigger) may still be inert and silently reject focus.
      restoreInert()
      // Restore focus to the trigger that opened the dialog. After a save/delete
      // the trigger often unmounts, so `focus()` would drop focus to <body>;
      // fall back to a stable, page-level focusable anchor in that case.
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus()
      } else {
        const fallback =
          document.querySelector<HTMLElement>('h1[tabindex="-1"]') ??
          document.getElementById('main-content')
        fallback?.focus()
      }
    }
  }, [active, containerRef])
}
