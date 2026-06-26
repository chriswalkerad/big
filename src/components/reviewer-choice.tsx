'use client'

import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import type { Person } from '@/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/button'

interface ReviewerChoiceProps {
  /** The roster to choose from (StorageRepository.listPeople()). */
  people: readonly Person[]
  /** The reviewer chosen last time, if any; otherwise the first roster member. */
  current?: Person
  /** Return to the review (signal rows) WITHOUT submitting. Restores focus sensibly. */
  onBack: () => void
  /** A reviewer is REQUIRED — confirm always carries one. */
  onConfirm: (reviewer: Person) => void
}

/**
 * In-panel choose-reviewer view that REPLACES the signal-row review in the results
 * panel body — the same mechanism as {@link ScoreExplanation}, NOT a popover/dialog.
 * The author picks WHO should review the document from the creative-department roster;
 * the chosen `Person` becomes `Document.reviewer` when they Submit. "Back" returns to
 * the review without submitting. A reviewer is required, so Submit is disabled until one
 * is selected. Styled to read as part of the panel (section header, label, body styles,
 * the same row treatment as the signal rows / summary).
 */
export function ReviewerChoice({ people, current, onBack, onConfirm }: ReviewerChoiceProps) {
  // A reviewer is required, so default to the prior choice or the first roster member.
  const [selectedId, setSelectedId] = useState<string>(current?.id ?? people[0]?.id ?? '')
  const selected = people.find((p) => p.id === selectedId)

  return (
    <section aria-label="Choose a reviewer" className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onBack}
        className={cn(
          'inline-flex h-8 w-fit items-center gap-1.5 rounded-control border border-border bg-surface px-2.5 text-label-sm text-text-secondary',
          'transition-colors hover:bg-panel hover:text-text-primary',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
        )}
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Back to review
      </button>

      <div className="flex flex-col gap-1">
        <h3 className="text-label-xs font-medium uppercase tracking-[0.05em] text-text-tertiary">
          Send to review
        </h3>
        <p className="text-body text-text-secondary">
          Pick who should review this document before you submit it.
        </p>
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="sr-only">Reviewer</legend>
        {people.map((person) => {
          const isSelected = selectedId === person.id
          return (
            <label
              key={person.id}
              className={cn(
                'flex cursor-pointer items-center gap-2.5 rounded-card border px-3 py-2.5 text-label-sm transition-colors',
                'focus-within:outline-none focus-within:ring-2 focus-within:ring-focus',
                isSelected
                  ? 'border-text-primary bg-panel text-text-primary'
                  : 'border-border bg-surface text-text-secondary hover:bg-panel',
              )}
            >
              <input
                type="radio"
                name="reviewer"
                value={person.id}
                checked={isSelected}
                onChange={() => setSelectedId(person.id)}
                className="size-3.5 shrink-0 accent-[var(--text-primary)] focus:outline-none"
              />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-body-emphasis text-text-primary">{person.name}</span>
                <span className="truncate text-label-sm text-text-tertiary">{person.role}</span>
              </span>
            </label>
          )
        })}
      </fieldset>

      <Button
        type="button"
        variant="ink"
        disabled={!selected}
        onClick={() => {
          if (selected) onConfirm(selected)
        }}
        className="w-full"
      >
        Submit for review
      </Button>
    </section>
  )
}
