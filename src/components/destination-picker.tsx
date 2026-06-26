'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { RoutingDestination } from '@/types'
import { Button } from '@/components/button'
import { cn } from '@/lib/utils'
import { useFocusTrap } from '@/lib/use-focus-trap'
import { DEFAULT_ROUTING, ROUTING_LABELS, ROUTING_ORDER } from '@/lib/doc-page'

interface DestinationPickerProps {
  open: boolean
  /** The doc's existing routing, if any; otherwise the default is preselected. */
  current?: RoutingDestination
  onClose: () => void
  onConfirm: (destination: RoutingDestination) => void
}

/**
 * Routing destination picker shown when a reviewer approves. Defaults to the doc's
 * existing routing or `digital_test`. Confirming records the routing and approves.
 * Mounts its body only while open so the selection resets on each open.
 */
export function DestinationPicker({ open, current, onClose, onConfirm }: DestinationPickerProps) {
  if (!open) return null
  return (
    <DestinationPickerBody current={current} onClose={onClose} onConfirm={onConfirm} />
  )
}

function DestinationPickerBody({
  current,
  onClose,
  onConfirm,
}: Omit<DestinationPickerProps, 'open'>) {
  const [selected, setSelected] = useState<RoutingDestination>(current ?? DEFAULT_ROUTING)
  const descriptionId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)

  // Move focus into the dialog, trap Tab, restore focus to the trigger on close.
  useFocusTrap(dialogRef, true)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cancel"
        onClick={onClose}
        className="absolute inset-0 bg-text-primary/20 backdrop-blur-sm"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Choose a destination"
        aria-describedby={descriptionId}
        className="relative z-10 flex w-full max-w-sm flex-col gap-4 rounded-card border border-border bg-surface p-5 shadow-lg"
      >
        <div className="flex flex-col gap-1">
          <h2 className="text-title text-text-primary">Approve & route</h2>
          <p id={descriptionId} className="text-body text-text-secondary">
            Pick where this concept goes next. You can change it later.
          </p>
        </div>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="sr-only">Destination</legend>
          {ROUTING_ORDER.map((destination) => {
            const isSelected = selected === destination
            return (
              <label
                key={destination}
                className={cn(
                  'flex cursor-pointer items-center gap-2.5 rounded-control border px-3 py-2 text-label-sm transition-colors',
                  isSelected
                    ? 'border-accent bg-panel text-text-primary'
                    : 'border-border bg-surface text-text-secondary hover:bg-panel',
                )}
              >
                <input
                  type="radio"
                  name="destination"
                  value={destination}
                  checked={isSelected}
                  onChange={() => setSelected(destination)}
                  className="size-3.5 accent-[var(--accent)]"
                />
                {ROUTING_LABELS[destination]}
              </label>
            )
          })}
        </fieldset>

        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="ink" onClick={() => onConfirm(selected)}>
            Approve
          </Button>
        </div>
      </div>
    </div>
  )
}
