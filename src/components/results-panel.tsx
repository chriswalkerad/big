'use client'

import { forwardRef, useEffect, useMemo, useRef, useState, type Ref } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Check, ChevronRight, HelpCircle, Loader2, Sparkles, X } from 'lucide-react'
import type { AppError } from '@/lib/errors'
import type { ReviewResult, SignalDef } from '@/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/button'
import {
  VERDICT_LABELS,
  formatFlagCount,
  inlineSignalIdSet,
  isVerdictProminent,
  signalDefMap,
} from '@/lib/doc-page'
import { SignalRow } from '@/components/signal-row'
import { ScoreExplanation } from '@/components/score-explanation'
import { LoadingState } from '@/components/loading-state'
import { ErrorState } from '@/components/error-state'

interface ResultsPanelProps {
  /** While true, the panel shows its loading state (review running). */
  loading?: boolean
  /** A typed error to render instead of results (review failed). */
  error?: AppError | null
  /** The review to render (verdict header + signal rows). */
  review?: ReviewResult | null
  /** Signal definitions, for names/thresholds/modes. */
  signals: SignalDef[]
  /** The currently focused signal id (bidirectional focus from a squiggle click). */
  focusedSignalId?: string | null
  /**
   * When true, the displayed review is an unsubmitted PREVIEW (review-then-confirm):
   * the panel offers a "Confirm submission" action that commits the submit. Omitted /
   * false for an already-submitted snapshot, which shows no confirm affordance.
   */
  pending?: boolean
  /** Retry the review (only meaningful with a retryable error). */
  onRetry?: () => void
  /** Commit the previewed review (only meaningful while `pending`). */
  onConfirm?: () => void
  /** Click a flagged phrase → focus its squiggle in the canvas. */
  onPhraseClick?: (signalId: string, quote: string) => void
  /** Open the franchise detail (from the Franchise Fit row). */
  onFranchiseClick?: () => void
  /**
   * Apply the suggested prompt as an AI rewrite of the body. The panel only exposes
   * the affordance and the in-flight spinner — the actual rewrite is wired by the
   * orchestrator. Omitted → no Apply button is shown.
   */
  onApplyPrompt?: () => void
  /** While true, the Apply button shows a spinner and is disabled. */
  applying?: boolean
  /** Collapse the detail panel back to the minimal strip (the `×`). */
  onClose?: () => void
}

const FRANCHISE_SIGNAL_ID = 'franchise_fit'

/**
 * The expandable review DETAIL panel. It is rendered inside the slide-in right-side
 * panel (desktop) / bottom sheet (mobile) owned by DocumentPage, and holds the full
 * review: verdict header (+ a `×` to collapse back to the minimal strip), the summary
 * + suggested prompt with Apply, the six signal rows, the "How is this calculated?"
 * methodology, and the sticky Confirm-submission footer for an unsubmitted preview.
 *
 * It owns NO outer surface chrome of its own (no border/background): the surrounding
 * `.review-panel` provides the surface. The header is pinned; the body
 * (`.review-panel-scroll`) is the single scroll container; the confirm footer is
 * sticky within it. When there is nothing to show — no review, not loading, no error —
 * it renders NOTHING (the panel is only opened once feedback exists).
 *
 * The forwarded ref points at the section so the page can manage focus when a review
 * appears or a signal row is targeted from a squiggle.
 */
export const ResultsPanel = forwardRef<HTMLElement, ResultsPanelProps>(function ResultsPanel(
  {
    loading,
    error,
    review,
    signals,
    focusedSignalId,
    pending,
    onRetry,
    onConfirm,
    onPhraseClick,
    onFranchiseClick,
    onApplyPrompt,
    applying,
    onClose,
  },
  ref,
) {
  // `signals` is loaded once and stable during editing, but DocumentPage re-renders this
  // panel on every keystroke and squiggle-focus change. Memoizing keeps the lookup
  // Map/Set from being rebuilt on each of those renders.
  const defs = useMemo(() => signalDefMap(signals), [signals])
  const inlineIds = useMemo(() => inlineSignalIdSet(signals), [signals])

  // The methodology panel ("How is this calculated?") replaces the score view in the
  // body while open. It's only meaningful for a settled review, so loading/error/no
  // review force it closed below.
  const [explaining, setExplaining] = useState(false)

  // The confirm bar shows only for a settled preview review (not loading/error) that
  // has a confirm handler — i.e. a review-then-confirm preview awaiting commit.
  const showConfirm = Boolean(pending && onConfirm && review && !loading && !error)

  // Hide the entire review section until there is something to show: a review (live
  // preview OR submitted snapshot), an in-flight run, or an error.
  const hasContent = Boolean(review || loading || error)

  // The methodology toggle only applies when settled results are showing.
  const canExplain = Boolean(review && !loading && !error)

  // Never show the methodology panel over a loading/error/no-review state. Adjusting
  // state during render (React's documented pattern) keeps this in sync without a
  // cascading effect.
  if (explaining && !canExplain) setExplaining(false)
  const showExplanation = explaining && canExplain

  // The header toggle, so "Back to results" can return focus to it.
  const explainToggleRef = useRef<HTMLButtonElement | null>(null)

  function closeExplanation() {
    setExplaining(false)
    // Return focus to the toggle that opened the panel.
    explainToggleRef.current?.focus()
  }

  // Respect the OS reduce-motion preference: render instantly (no transforms),
  // composing with the global CSS reduced-motion rule in globals.css.
  const reduceMotion = useReducedMotion()

  // Hold a ref to the focused row so we can scroll it into view.
  const focusedRowRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const node = focusedRowRef.current
    if (focusedSignalId && node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [focusedSignalId])

  // Nothing to show yet → render nothing.
  if (!hasContent) return null

  return (
    <section
      ref={ref}
      role="region"
      aria-label="Review results"
      tabIndex={-1}
      className={cn('flex h-full w-full min-w-0 flex-col focus:outline-none')}
    >
      <PanelHeader
        review={review}
        loading={loading}
        error={error}
        canExplain={canExplain}
        explaining={showExplanation}
        onToggleExplain={() => setExplaining((v) => !v)}
        explainToggleRef={explainToggleRef}
        onClose={onClose}
      />

      <div className="review-panel-scroll">
        <div className="px-4 py-3">
          {loading ? (
            <LoadingState rows={6} label="Running review…" />
          ) : error ? (
            <ErrorState error={error} onRetry={onRetry} title="Review failed" />
          ) : showExplanation ? (
            <ScoreExplanation signals={signals} onBack={closeExplanation} />
          ) : review ? (
            <div className="flex flex-col gap-3">
              {review.summary ? (
                <ReviewSummary
                  summary={review.summary}
                  suggestedPrompt={review.suggestedPrompt}
                  onApplyPrompt={onApplyPrompt}
                  applying={applying}
                />
              ) : null}
              <motion.div
                className="flex flex-col gap-2"
                initial={reduceMotion ? false : 'hidden'}
                animate="shown"
                variants={reduceMotion ? undefined : LIST_VARIANTS}
              >
                {review.signals.map((result) => {
                  const def = defs.get(result.signalId)
                  if (!def) return null
                  const isFocused = focusedSignalId === result.signalId
                  return (
                    <motion.div
                      key={result.signalId}
                      variants={reduceMotion ? undefined : ROW_VARIANTS}
                    >
                      <SignalRow
                        ref={isFocused ? focusedRowRef : undefined}
                        def={def}
                        result={result}
                        focused={isFocused}
                        inline={inlineIds.has(result.signalId)}
                        franchise={result.signalId === FRANCHISE_SIGNAL_ID}
                        onPhraseClick={onPhraseClick}
                        onFranchiseClick={onFranchiseClick}
                      />
                    </motion.div>
                  )
                })}
              </motion.div>
            </div>
          ) : null}
        </div>

        {showConfirm ? (
          // Sticky to the bottom of the panel scroll so "Confirm submission" is always
          // reachable while the body scrolls past it.
          <footer className="sticky bottom-0 z-10 flex flex-col gap-2 border-t border-border bg-surface px-4 py-3">
            <p className="text-label-sm text-text-secondary">
              Review preview — not submitted yet. Edit to revise, or confirm to submit.
            </p>
            <Button variant="ink" onClick={onConfirm} className="w-full">
              <Check className="size-3.5" aria-hidden="true" />
              Confirm submission
            </Button>
          </footer>
        ) : null}
      </div>
    </section>
  )
})

// Subtle staggered fade/slide-in for the signal rows when results render.
const LIST_VARIANTS = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.04, delayChildren: 0.06 } },
}

const ROW_VARIANTS = {
  hidden: { opacity: 0, y: 6 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.22, ease: 'easeOut' as const } },
}

/**
 * The slim REVIEW STRIP — the minimal default under the document meta line. It renders
 * NOTHING until a review exists / is running / errored, then shows a one-line
 * disclosure: a verdict label, the "N of 6 need attention" count, a one-line summary,
 * an optional "Apply fix" affordance, and a "View N signals" toggle that opens the
 * detail panel. Clicking the strip's verdict count / summary also opens the panel.
 */
export function ReviewStrip({
  loading,
  error,
  review,
  onView,
  onApplyPrompt,
  applying,
}: {
  loading?: boolean
  error?: AppError | null
  review?: ReviewResult | null
  /** Open the expandable detail panel. */
  onView: () => void
  /** Apply the suggested prompt (the "Apply fix" affordance). Omitted → hidden. */
  onApplyPrompt?: () => void
  applying?: boolean
}) {
  const hasContent = Boolean(review || loading || error)
  if (!hasContent) return null

  const verdict = review?.verdict
  const total = review?.signals.length ?? 0
  const prominent = verdict ? isVerdictProminent(verdict.label) : false

  let label = 'Review'
  if (loading) label = 'Reviewing…'
  else if (error) label = 'Review failed'
  else if (verdict) label = VERDICT_LABELS[verdict.label]

  const summary = review?.summary
  const canApply = Boolean(onApplyPrompt && review?.suggestedPrompt && !loading && !error)
  const viewLabel = total > 0 ? `View ${total} signals` : 'View review'

  return (
    <section
      aria-label="Review summary"
      className="flex flex-col gap-2 rounded-card border border-border bg-panel px-3.5 py-3"
    >
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        {loading ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-text-secondary" aria-hidden="true" />
        ) : (
          <span
            aria-hidden="true"
            className={cn(
              'size-2 shrink-0 rounded-pill',
              error ? 'bg-risk' : prominent ? 'bg-minor' : 'bg-pass',
            )}
          />
        )}
        <span className="text-body-emphasis text-text-primary" data-verdict={verdict?.label}>
          {label}
        </span>
        {!loading && !error && verdict ? (
          <span className="text-label-sm tabular-nums text-text-secondary">
            {formatFlagCount(verdict.flagCount, total)}
          </span>
        ) : null}
        <button
          type="button"
          onClick={onView}
          className={cn(
            'ml-auto inline-flex shrink-0 items-center gap-1 rounded-control px-1.5 py-1 text-label-sm text-text-secondary',
            'transition-colors hover:bg-surface hover:text-text-primary',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          )}
        >
          {viewLabel}
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </button>
      </div>

      {summary ? (
        <button
          type="button"
          onClick={onView}
          className={cn(
            'line-clamp-1 rounded-control text-left text-body text-text-secondary',
            'transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          )}
        >
          {summary}
        </button>
      ) : null}

      {canApply ? (
        <div>
          <Button
            variant="default"
            onClick={onApplyPrompt}
            disabled={applying}
            aria-label="Apply suggested fix"
            aria-busy={applying ? true : undefined}
          >
            {applying ? (
              <Loader2 className="size-3 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="size-3 text-accent" aria-hidden="true" />
            )}
            {applying ? 'Applying…' : 'Apply fix'}
          </Button>
        </div>
      ) : null}
    </section>
  )
}

/**
 * The overall "what to do" summary plus an optional AI prompt, rendered at the top of
 * the panel body above the signal rows. The "Apply" button hands the suggested prompt
 * to the page's `onApplyPrompt` callback (the AI rewrite is wired elsewhere) and shows
 * a spinner while `applying` is true.
 */
function ReviewSummary({
  summary,
  suggestedPrompt,
  onApplyPrompt,
  applying,
}: {
  summary: string
  suggestedPrompt?: string
  onApplyPrompt?: () => void
  applying?: boolean
}) {
  return (
    <section
      aria-label="Summary and suggested prompt"
      className="flex flex-col gap-2 rounded-card border border-border bg-panel px-3 py-3"
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-label-xs font-medium uppercase tracking-[0.05em] text-text-tertiary">
          Summary — what to do
        </h3>
        <p className="text-label-sm text-text-primary">{summary}</p>
      </div>
      {suggestedPrompt ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <h4 className="inline-flex items-center gap-1.5 text-label-xs font-medium uppercase tracking-[0.05em] text-text-tertiary">
              <Sparkles className="size-3" aria-hidden="true" />
              Suggested prompt
            </h4>
            {onApplyPrompt ? (
              <Button
                variant="default"
                onClick={onApplyPrompt}
                disabled={applying}
                aria-label="Apply suggested prompt"
                aria-busy={applying ? true : undefined}
              >
                {applying ? (
                  <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="size-3 text-accent" aria-hidden="true" />
                )}
                <span>{applying ? 'Applying…' : 'Apply'}</span>
              </Button>
            ) : null}
          </div>
          <p className="whitespace-pre-wrap rounded-control border border-border bg-surface px-2.5 py-2 text-label-sm text-text-secondary">
            {suggestedPrompt}
          </p>
        </div>
      ) : null}
    </section>
  )
}

function PanelHeader({
  review,
  loading,
  error,
  canExplain,
  explaining,
  onToggleExplain,
  explainToggleRef,
  onClose,
}: {
  review?: ReviewResult | null
  loading?: boolean
  error?: AppError | null
  /** Whether the "How is this calculated?" toggle should be offered. */
  canExplain: boolean
  /** Whether the methodology panel is currently shown (drives aria + label). */
  explaining: boolean
  /** Toggle the methodology panel on/off. */
  onToggleExplain: () => void
  /** Ref to the toggle so "Back to results" can restore focus to it. */
  explainToggleRef: Ref<HTMLButtonElement>
  /** Collapse the panel back to the minimal strip. */
  onClose?: () => void
}) {
  const reduceMotion = useReducedMotion()
  const verdict = review?.verdict
  const prominent = verdict ? isVerdictProminent(verdict.label) : false
  const notReady = verdict?.label === 'not_ready'

  let title = 'Review'
  if (loading) title = 'Reviewing…'
  else if (error) title = 'Review failed'
  else if (verdict) title = VERDICT_LABELS[verdict.label]

  return (
    <header className="flex flex-col gap-2 border-b border-border px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-2.5">
          <h2 className="text-title text-text-primary" data-verdict={verdict?.label}>
            {title}
          </h2>
          {prominent && verdict ? (
            <motion.span
              key={verdict.label}
              initial={reduceMotion ? false : { scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 24 }}
              className={cn(
                'inline-flex items-center rounded-pill border px-2 py-0.5 text-label-xs uppercase tracking-[0.05em]',
                notReady ? 'border-risk text-risk' : 'border-minor text-minor',
              )}
              data-verdict={verdict.label}
            >
              {notReady ? 'Action needed' : 'Needs attention'}
            </motion.span>
          ) : null}
          {!loading && !error && verdict ? (
            <span className="text-label-sm tabular-nums text-text-secondary">
              {formatFlagCount(verdict.flagCount, review?.signals.length ?? 0)}
            </span>
          ) : null}
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close review details"
            className={cn(
              'inline-flex size-7 shrink-0 items-center justify-center rounded-control text-text-secondary',
              'transition-colors hover:bg-panel hover:text-text-primary',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            )}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {canExplain ? (
        <button
          ref={explainToggleRef}
          type="button"
          onClick={onToggleExplain}
          aria-expanded={explaining}
          aria-pressed={explaining}
          className={cn(
            'inline-flex h-7 w-fit items-center gap-1.5 rounded-control px-2 text-label-sm text-text-secondary transition-colors',
            'hover:bg-panel hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            explaining ? 'bg-panel text-text-primary' : '',
          )}
        >
          <HelpCircle className="size-3.5" aria-hidden="true" />
          How is this calculated?
        </button>
      ) : null}
    </header>
  )
}
