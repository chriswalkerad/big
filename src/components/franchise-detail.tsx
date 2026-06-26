'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import type { Project } from '@/types'
import { cn } from '@/lib/utils'
import { useFocusTrap } from '@/lib/use-focus-trap'

interface FranchiseDetailProps {
  project: Project
  open: boolean
  onClose: () => void
}

/**
 * Read-only franchise detail, opened from the Franchise Fit row so a low score is
 * explainable. Shows the project name, audience, the franchise context (tone/world),
 * and tags. Live prompting against the franchise is explicitly out of scope.
 */
export function FranchiseDetail({ project, open, onClose }: FranchiseDetailProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  // Move focus into the dialog, trap Tab, restore focus to the trigger on close.
  useFocusTrap(dialogRef, open)

  // Close on Escape while open.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close franchise detail"
        onClick={onClose}
        className="absolute inset-0 bg-text-primary/20 backdrop-blur-sm"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Franchise detail: ${project.name}`}
        className={cn(
          'relative z-10 flex w-full max-w-md flex-col gap-4 rounded-card border border-border bg-surface p-5 shadow-lg',
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-label-xs uppercase tracking-[0.05em] text-text-tertiary">Franchise</span>
            <h2 className="text-title text-text-primary">{project.name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-control text-text-tertiary transition-colors hover:bg-panel hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <Field label="Audience">{project.audience}</Field>
        <Field label="Tone & world">{project.franchiseContext}</Field>

        {project.tags.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-label-xs uppercase tracking-[0.05em] text-text-tertiary">Tags</span>
            <ul className="flex flex-wrap gap-1.5">
              {project.tags.map((tag) => (
                <li
                  key={tag}
                  className="inline-flex items-center rounded-pill border border-border bg-panel px-2 py-0.5 text-label-sm text-text-secondary"
                >
                  {tag}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-label-xs uppercase tracking-[0.05em] text-text-tertiary">{label}</span>
      <p className="text-body text-text-secondary">{children}</p>
    </div>
  )
}
