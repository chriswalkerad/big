'use client'

import { useEffect, useRef, useState } from 'react'
import type { Person } from '@/types'
import { Button } from '@/components/button'
import { cn } from '@/lib/utils'
import { useFocusTrap } from '@/lib/use-focus-trap'

interface ReviewerPickerProps {
  open: boolean
  /** The roster to choose from (StorageRepository.listPeople()). */
  people: readonly Person[]
  /** The reviewer chosen last time, if any; otherwise the first roster member. */
  current?: Person
  onClose: () => void
  /** A reviewer is REQUIRED — confirm always carries one. */
  onConfirm: (reviewer: Person) => void
}

/**
 * Reviewer picker shown when an author confirms a submission. The author must choose
 * WHO should review the document from the creative-department roster before the submit
 * is committed; the chosen `Person` becomes `Document.reviewer`. Mirrors the
 * DestinationPicker dialog pattern (focus trap, Escape to cancel, radio list, ink
 * Confirm). Mounts its body only while open so the selection resets on each open.
 */
export function ReviewerPicker({
  open,
  people,
  current,
  onClose,
  onConfirm,
}: ReviewerPickerProps) {
  if (!open) return null
  return (
    <ReviewerPickerBody
      people={people}
      current={current}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  )
}

function ReviewerPickerBody({
  people,
  current,
  onClose,
  onConfirm,
}: Omit<ReviewerPickerProps, 'open'>) {
  // A reviewer is required, so default to the prior choice or the first roster member.
  const [selectedId, setSelectedId] = useState<string>(current?.id ?? people[0]?.id ?? '')
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

  const selected = people.find((p) => p.id === selectedId)

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
        aria-label="Choose a reviewer"
        className="relative z-10 flex max-h-[80vh] w-full max-w-sm flex-col gap-4 rounded-card border border-border bg-surface p-5 shadow-lg"
      >
        <div className="flex flex-col gap-1">
          <h2 className="text-title text-text-primary">Choose a reviewer</h2>
          <p className="text-body text-text-secondary">
            Pick who should review this document before you submit it.
          </p>
        </div>

        <fieldset className="flex min-h-0 flex-col gap-1.5 overflow-y-auto">
          <legend className="sr-only">Reviewer</legend>
          {people.map((person) => {
            const isSelected = selectedId === person.id
            return (
              <label
                key={person.id}
                className={cn(
                  'flex cursor-pointer items-center gap-2.5 rounded-control border px-3 py-2 text-label-sm transition-colors',
                  isSelected
                    ? 'border-accent bg-panel text-text-primary'
                    : 'border-border bg-surface text-text-secondary hover:bg-panel',
                )}
              >
                <input
                  type="radio"
                  name="reviewer"
                  value={person.id}
                  checked={isSelected}
                  onChange={() => setSelectedId(person.id)}
                  className="size-3.5 shrink-0 accent-[var(--accent)]"
                />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-text-primary">{person.name}</span>
                  <span className="truncate text-text-tertiary">{person.role}</span>
                </span>
              </label>
            )
          })}
        </fieldset>

        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="ink"
            disabled={!selected}
            onClick={() => {
              if (selected) onConfirm(selected)
            }}
          >
            Submit for review
          </Button>
        </div>
      </div>
    </div>
  )
}
