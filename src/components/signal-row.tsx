'use client'

import { forwardRef } from 'react'
import type { SignalDef, SignalResult } from '@/types'
import { cn } from '@/lib/utils'
import { SignalBar } from '@/components/signal-bar'

interface SignalRowProps {
  /** The signal definition (name + threshold). */
  def: SignalDef
  /** The reviewed result for this signal (score, rationale, issues). */
  result: SignalResult
  /**
   * True when this row is the focus target of a squiggle click (bidirectional
   * focus). Emphasises the row and is used to scroll it into view.
   */
  focused?: boolean
  /** Inline signal (Clarity / Brand Safety) → renders its flagged phrases. */
  inline?: boolean
  /** The Franchise Fit row gets a clickable reference into the franchise detail. */
  franchise?: boolean
  /** Click a flagged phrase → focus + scroll the matching squiggle in the canvas. */
  onPhraseClick?: (signalId: string, quote: string) => void
  /** Click the franchise reference → open the franchise detail panel. */
  onFranchiseClick?: () => void
}

/**
 * One signal in the results drawer: name, a bare 0–100 score (tabular), a proportional
 * fill bar colored by the signal's own threshold, and the rationale. Inline signals
 * also list their flagged phrases (clickable for bidirectional focus). The Franchise
 * Fit row renders a clickable "franchise" reference into the franchise detail.
 */
export const SignalRow = forwardRef<HTMLDivElement, SignalRowProps>(function SignalRow(
  { def, result, focused, inline, franchise, onPhraseClick, onFranchiseClick },
  ref,
) {
  const { score, rationale, issues } = result

  return (
    <div
      ref={ref}
      data-signal-id={def.id}
      data-focused={focused ? 'true' : undefined}
      className={cn(
        'flex flex-col gap-1.5 rounded-card border px-3 py-2.5 transition-colors',
        focused ? 'border-accent bg-panel' : 'border-border bg-surface',
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-body-emphasis text-text-primary">{def.name}</span>
        <span className="text-label-sm tabular-nums text-text-primary">{score}</span>
      </div>

      <SignalBar score={score} threshold={def.threshold} />

      <p className="text-body text-text-secondary">
        {franchise ? <FranchiseRationale rationale={rationale} onFranchiseClick={onFranchiseClick} /> : rationale}
      </p>

      {inline && issues.length > 0 ? (
        <ul className="mt-1 flex flex-col gap-1">
          {issues.map((issue, i) => (
            <li key={`${def.id}-issue-${i}`}>
              <button
                type="button"
                onClick={() => onPhraseClick?.(def.id, issue.quote)}
                className={cn(
                  'group flex w-full flex-col gap-0.5 rounded-control border border-border bg-panel px-2 py-1.5 text-left transition-colors',
                  'hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                )}
              >
                <span
                  data-severity={issue.severity}
                  className={cn(
                    'text-label-sm',
                    issue.severity === 'risk' ? 'text-risk' : 'text-minor',
                  )}
                >
                  “{issue.quote}”
                </span>
                <span className="text-label-sm text-text-secondary">{issue.message}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
})

/**
 * The Franchise Fit rationale with a clickable "franchise" reference. We render the
 * rationale text and append an explicit affordance so a low score is explainable.
 */
function FranchiseRationale({
  rationale,
  onFranchiseClick,
}: {
  rationale: string
  onFranchiseClick?: () => void
}) {
  return (
    <>
      {rationale}{' '}
      <button
        type="button"
        onClick={onFranchiseClick}
        className={cn(
          'rounded-control text-label-sm text-text-primary underline decoration-dotted underline-offset-2',
          'transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        )}
      >
        View franchise
      </button>
    </>
  )
}
