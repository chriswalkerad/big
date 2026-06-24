'use client'

import { History, RotateCcw, Undo2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DriftIndicatorProps {
  /** Resubmit: re-run review on the current body and replace the snapshot. */
  onResubmit: () => void
  /** Unsubmit: clear the snapshot and return to draft (manual only). */
  onUnsubmit: () => void
  /** True while a resubmit review is in flight. */
  busy?: boolean
  className?: string
}

/**
 * The "edited since submit" indicator (version drift, EPIC 12). Shown when the live
 * body diverges from the submitted snapshot. Offers Resubmit (replace the snapshot)
 * and Unsubmit (clear it, back to draft). Never blocks editing.
 */
export function DriftIndicator({ onResubmit, onUnsubmit, busy, className }: DriftIndicatorProps) {
  return (
    <div
      role="status"
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-card border border-minor bg-panel px-3 py-2',
        className,
      )}
    >
      <span className="inline-flex items-center gap-1.5 text-label-sm text-minor-text">
        <History className="size-3.5" aria-hidden="true" />
        Edited since submit
      </span>
      <span className="text-label-sm text-text-tertiary">
        The reviewer still sees the submitted version.
      </span>
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onUnsubmit}
          disabled={busy}
          className="inline-flex h-8 items-center gap-1.5 rounded-control border border-border bg-surface px-2.5 text-label-sm text-text-secondary transition-colors hover:bg-panel hover:text-text-primary disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Undo2 className="size-3.5" aria-hidden="true" />
          Unsubmit
        </button>
        <button
          type="button"
          onClick={onResubmit}
          disabled={busy}
          className="inline-flex h-8 items-center gap-1.5 rounded-control bg-accent px-2.5 text-label-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
          {busy ? 'Resubmitting…' : 'Resubmit'}
        </button>
      </div>
    </div>
  )
}
