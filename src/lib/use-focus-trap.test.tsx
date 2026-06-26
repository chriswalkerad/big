import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { useRef } from 'react'
import { useFocusTrap } from './use-focus-trap'

afterEach(cleanup)

/** Minimal harness: a dialog using the trap, plus background siblings to hide. */
function Harness({ active }: { active: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useFocusTrap(ref, active)
  return (
    <div>
      <main id="main-content" tabIndex={-1} data-testid="background">
        background content
      </main>
      <div ref={ref} role="dialog" data-testid="dialog">
        <button type="button">In dialog</button>
      </div>
    </div>
  )
}

describe('useFocusTrap — inert background (#1)', () => {
  it('marks background siblings inert while active and restores on close', () => {
    const { getByTestId, rerender } = render(<Harness active />)
    expect(getByTestId('background').inert).toBe(true)

    rerender(<Harness active={false} />)
    expect(getByTestId('background').inert).toBeFalsy()
  })

  it('does not mark the dialog (or its ancestors) inert', () => {
    const { getByTestId } = render(<Harness active />)
    expect(getByTestId('dialog').inert).toBeFalsy()
  })
})

/**
 * Harness where the trigger stays mounted *through* opening (so the trap captures
 * it as the previously-focused element) but unmounts on close — the #8 scenario
 * (a row's Edit/Delete button that vanishes after the save/delete it triggered).
 */
function UnmountHarness({
  open,
  triggerMounted,
}: {
  open: boolean
  triggerMounted: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  useFocusTrap(ref, open)
  return (
    <div>
      <h1 tabIndex={-1} data-testid="anchor">
        Page title
      </h1>
      {triggerMounted ? (
        <button type="button" data-testid="trigger">
          Open
        </button>
      ) : null}
      {open ? (
        <div ref={ref} role="dialog">
          <button type="button">In dialog</button>
        </div>
      ) : null}
    </div>
  )
}

describe('useFocusTrap — focus restore fallback (#8)', () => {
  it('falls back to a stable anchor when the trigger has unmounted', () => {
    const { getByTestId, rerender } = render(
      <UnmountHarness open={false} triggerMounted />,
    )
    getByTestId('trigger').focus()
    expect(document.activeElement).toBe(getByTestId('trigger'))

    // Open while the trigger is still mounted: the trap captures it as the
    // element to restore on close.
    rerender(<UnmountHarness open triggerMounted />)

    // Close AND unmount the trigger in the same commit (post-save/delete). The
    // captured trigger is now disconnected, so focus must land on the
    // tabindex=-1 <h1> anchor rather than silently dropping to <body>.
    rerender(<UnmountHarness open={false} triggerMounted={false} />)
    expect(document.activeElement).toBe(getByTestId('anchor'))
  })

  it('restores focus to the trigger when it is still mounted', () => {
    const { getByTestId, rerender } = render(
      <UnmountHarness open={false} triggerMounted />,
    )
    getByTestId('trigger').focus()
    rerender(<UnmountHarness open triggerMounted />)
    rerender(<UnmountHarness open={false} triggerMounted />)
    expect(document.activeElement).toBe(getByTestId('trigger'))
  })
})
