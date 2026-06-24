'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import type { AppError } from '@/lib/errors'
import type { ReviewResult, SignalDef } from '@/types'
import { cn } from '@/lib/utils'
import {
  VERDICT_LABELS,
  formatFlagCount,
  inlineSignalIdSet,
  isVerdictProminent,
  signalDefMap,
} from '@/lib/doc-page'
import { SignalRow } from '@/components/signal-row'
import { LoadingState } from '@/components/loading-state'
import { ErrorState } from '@/components/error-state'

interface ResultsDrawerProps {
  open: boolean
  /** While true, the drawer shows its loading state (review running). */
  loading?: boolean
  /** A typed error to render instead of results (review failed). */
  error?: AppError | null
  /** The review to render (verdict header + signal rows). */
  review?: ReviewResult | null
  /** Signal definitions, for names/thresholds/modes. */
  signals: SignalDef[]
  /** The currently focused signal id (bidirectional focus from a squiggle click). */
  focusedSignalId?: string | null
  onClose: () => void
  /** Retry the review (only meaningful with a retryable error). */
  onRetry?: () => void
  /** Click a flagged phrase → focus its squiggle in the canvas. */
  onPhraseClick?: (signalId: string, quote: string) => void
  /** Open the franchise detail (from the Franchise Fit row). */
  onFranchiseClick?: () => void
}

const FRANCHISE_SIGNAL_ID = 'franchise_fit'

/**
 * Bottom-sheet results drawer. Slides up on submit, dismissable, fixed height. The
 * header shows the overall verdict + flag count (computed on submit, never live); the
 * body lists every signal as a SignalRow. Handles its own loading and error states.
 */
export function ResultsDrawer({
  open,
  loading,
  error,
  review,
  signals,
  focusedSignalId,
  onClose,
  onRetry,
  onPhraseClick,
  onFranchiseClick,
}: ResultsDrawerProps) {
  const defs = signalDefMap(signals)
  const inlineIds = inlineSignalIdSet(signals)

  // Hold a ref to the focused row so we can scroll it into view.
  const focusedRowRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const node = focusedRowRef.current
    if (focusedSignalId && node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [focusedSignalId])

  // Close on Escape.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <div
      aria-hidden={!open}
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-0 pb-0 transition-transform duration-300 ease-out sm:px-4 sm:pb-4',
        open ? 'translate-y-0' : 'translate-y-[110%]',
      )}
    >
      <section
        role="dialog"
        aria-label="Review results"
        aria-modal="false"
        className={cn(
          'pointer-events-auto flex h-[min(60vh,32rem)] w-full max-w-3xl flex-col overflow-hidden',
          'rounded-t-card border border-border bg-surface shadow-lg sm:rounded-card',
        )}
      >
        <DrawerHeader review={review} loading={loading} error={error} onClose={onClose} />

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <LoadingState rows={6} label="Running review…" />
          ) : error ? (
            <ErrorState error={error} onRetry={onRetry} title="Review failed" />
          ) : review ? (
            <div className="flex flex-col gap-2">
              {review.signals.map((result) => {
                const def = defs.get(result.signalId)
                if (!def) return null
                const isFocused = focusedSignalId === result.signalId
                return (
                  <SignalRow
                    key={result.signalId}
                    ref={isFocused ? focusedRowRef : undefined}
                    def={def}
                    result={result}
                    focused={isFocused}
                    inline={inlineIds.has(result.signalId)}
                    franchise={result.signalId === FRANCHISE_SIGNAL_ID}
                    onPhraseClick={onPhraseClick}
                    onFranchiseClick={onFranchiseClick}
                  />
                )
              })}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}

function DrawerHeader({
  review,
  loading,
  error,
  onClose,
}: {
  review?: ReviewResult | null
  loading?: boolean
  error?: AppError | null
  onClose: () => void
}) {
  const verdict = review?.verdict
  const prominent = verdict ? isVerdictProminent(verdict.label) : false
  const notReady = verdict?.label === 'not_ready'

  let title = 'Review'
  if (loading) title = 'Reviewing…'
  else if (error) title = 'Review failed'
  else if (verdict) title = VERDICT_LABELS[verdict.label]

  return (
    <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
      <div className="flex items-baseline gap-2.5">
        <h2 className="text-title text-text-primary" data-verdict={verdict?.label}>
          {title}
        </h2>
        {prominent && verdict ? (
          <span
            className={cn(
              'inline-flex items-center rounded-pill border px-2 py-0.5 text-label-xs uppercase tracking-[0.05em]',
              notReady ? 'border-risk text-risk' : 'border-minor text-minor',
            )}
            data-verdict={verdict.label}
          >
            {notReady ? 'Action needed' : 'Needs attention'}
          </span>
        ) : null}
        {!loading && !error && verdict ? (
          <span className="text-label-sm tabular-nums text-text-secondary">
            {formatFlagCount(verdict.flagCount, review?.signals.length ?? 0)}
          </span>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss results"
        className="rounded-control p-1 text-text-tertiary transition-colors hover:bg-panel hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </header>
  )
}
