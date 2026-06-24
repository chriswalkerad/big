'use client'

import { useEffect, useRef, useState, type Ref } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Check, Copy, HelpCircle, Sparkles, X } from 'lucide-react'
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
import { ScoreExplanation } from '@/components/score-explanation'
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
  /**
   * When true, the displayed review is an unsubmitted PREVIEW (review-then-confirm):
   * the drawer offers a "Confirm submission" action that commits the submit. Omitted /
   * false for an already-submitted snapshot, which shows no confirm affordance.
   */
  pending?: boolean
  onClose: () => void
  /** Retry the review (only meaningful with a retryable error). */
  onRetry?: () => void
  /** Commit the previewed review (only meaningful while `pending`). */
  onConfirm?: () => void
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
  pending,
  onClose,
  onRetry,
  onConfirm,
  onPhraseClick,
  onFranchiseClick,
}: ResultsDrawerProps) {
  const defs = signalDefMap(signals)
  const inlineIds = inlineSignalIdSet(signals)

  // The methodology panel ("How is this calculated?") replaces the score view in the
  // body while open. It's only meaningful for a settled review, so loading/error/no
  // review force it closed below.
  const [explaining, setExplaining] = useState(false)

  // The confirm bar shows only for a settled preview review (not loading/error) that
  // has a confirm handler — i.e. a review-then-confirm preview awaiting commit.
  const showConfirm = Boolean(pending && onConfirm && review && !loading && !error)

  // The methodology toggle only applies when settled results are showing.
  const canExplain = Boolean(review && !loading && !error)

  // Close the panel when the drawer is closed, so reopening shows the rows again — and
  // never show it over a loading/error/no-review state. Adjusting state during render
  // (React's documented pattern) keeps this in sync without a cascading effect.
  if (explaining && (!open || !canExplain)) setExplaining(false)
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

  // Close on Escape.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // A snappy spring on open; an eased slide on close. When reduce-motion is set we
  // skip the transform entirely (the panel just appears/disappears).
  const sheetTransition = reduceMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 380, damping: 34, mass: 0.9 }

  return (
    <div
      aria-hidden={!open}
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-0 pb-0 sm:px-4 sm:pb-4',
      )}
    >
      <AnimatePresence>
        {open ? (
          <motion.section
            key="results-drawer"
            role="dialog"
            aria-label="Review results"
            aria-modal="false"
            initial={reduceMotion ? false : { y: '110%' }}
            animate={{ y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { y: '110%' }}
            transition={sheetTransition}
            className={cn(
              'pointer-events-auto flex h-[min(60vh,32rem)] w-full max-w-3xl flex-col overflow-hidden',
              'rounded-t-card border border-border bg-surface shadow-lg sm:rounded-card',
            )}
          >
            <DrawerHeader
              review={review}
              loading={loading}
              error={error}
              onClose={onClose}
              canExplain={canExplain}
              explaining={showExplanation}
              onToggleExplain={() => setExplaining((v) => !v)}
              explainToggleRef={explainToggleRef}
            />

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
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
              <footer className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
                <p className="text-label-sm text-text-secondary">
                  Review preview — not submitted yet. Edit to revise, or confirm to submit.
                </p>
                <button
                  type="button"
                  onClick={onConfirm}
                  className={cn(
                    'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-control bg-accent px-3 text-label-sm font-medium text-bg',
                    'transition-[transform,opacity] hover:opacity-90 active:scale-[0.98]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  )}
                >
                  <Check className="size-3.5" aria-hidden="true" />
                  Confirm submission
                </button>
              </footer>
            ) : null}
          </motion.section>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

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
 * The overall "what to do" summary plus an optional copy-able AI prompt, rendered
 * at the top of the drawer body above the signal rows. The copy button reuses the
 * clipboard pattern from CopyLinkButton (transient "Copied" confirmation).
 */
function ReviewSummary({
  summary,
  suggestedPrompt,
}: {
  summary: string
  suggestedPrompt?: string
}) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1800)
    return () => clearTimeout(t)
  }, [copied])

  async function copyPrompt() {
    if (!suggestedPrompt) return
    try {
      await navigator.clipboard?.writeText(suggestedPrompt)
      setCopied(true)
    } catch {
      // Clipboard blocked (permissions / insecure context); fail quietly.
      setCopied(false)
    }
  }

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
            <button
              type="button"
              onClick={copyPrompt}
              aria-label="Copy suggested prompt"
              className={cn(
                'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-control border border-border bg-surface px-2 text-label-xs text-text-secondary',
                'transition-colors hover:bg-panel hover:text-text-primary',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              )}
            >
              {copied ? (
                <Check className="size-3 text-pass" aria-hidden="true" />
              ) : (
                <Copy className="size-3" aria-hidden="true" />
              )}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <p className="whitespace-pre-wrap rounded-control border border-border bg-surface px-2.5 py-2 text-label-sm text-text-secondary">
            {suggestedPrompt}
          </p>
        </div>
      ) : null}
    </section>
  )
}

function DrawerHeader({
  review,
  loading,
  error,
  onClose,
  canExplain,
  explaining,
  onToggleExplain,
  explainToggleRef,
}: {
  review?: ReviewResult | null
  loading?: boolean
  error?: AppError | null
  onClose: () => void
  /** Whether the "How is this calculated?" toggle should be offered. */
  canExplain: boolean
  /** Whether the methodology panel is currently shown (drives aria + label). */
  explaining: boolean
  /** Toggle the methodology panel on/off. */
  onToggleExplain: () => void
  /** Ref to the toggle so "Back to results" can restore focus to it. */
  explainToggleRef: Ref<HTMLButtonElement>
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
    <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
      <div className="flex items-baseline gap-2.5">
        <h2 className="text-title text-text-primary" data-verdict={verdict?.label}>
          {title}
        </h2>
        {prominent && verdict ? (
          <motion.span
            // A small pop draws the eye to the most prominent verdict states.
            // The key re-mounts the badge per verdict so the pop replays on change.
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
      <div className="flex items-center gap-1">
        {canExplain ? (
          <button
            ref={explainToggleRef}
            type="button"
            onClick={onToggleExplain}
            aria-expanded={explaining}
            aria-pressed={explaining}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-control px-2 text-label-sm text-text-secondary transition-colors',
              'hover:bg-panel hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              explaining ? 'bg-panel text-text-primary' : '',
            )}
          >
            <HelpCircle className="size-3.5" aria-hidden="true" />
            How is this calculated?
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss results"
          className="rounded-control p-1 text-text-tertiary transition-colors hover:bg-panel hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </header>
  )
}
