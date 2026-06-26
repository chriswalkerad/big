'use client'

import { ArrowLeft } from 'lucide-react'
import type { SignalDef } from '@/types'
import { cn } from '@/lib/utils'

interface ScoreExplanationProps {
  /** The signal definitions — names, prompts, modes, thresholds drive the copy. */
  signals: SignalDef[]
  /** Return to the score view (the signal rows). Should restore focus sensibly. */
  onBack: () => void
}

/**
 * Brand Safety detection mirrors `computeVerdict` in src/lib/providers/mock.ts:
 * a signal whose id matches this pattern can single-handedly drive a `not_ready`
 * verdict. We surface that in the copy so the explanation matches the real rule.
 */
const BRAND_SAFETY_ID = /brand[\s_-]?safety|safety/

function isBrandSafety(id: string): boolean {
  return BRAND_SAFETY_ID.test(id.toLowerCase())
}

/**
 * Methodology panel that REPLACES the signal-row score view in the results drawer.
 * It explains how scoring works in general (not for one document): what each signal
 * judges, where its pass threshold sits, what the bar colors mean, and how the
 * signals combine into the overall verdict. All copy is derived from the signal
 * definitions plus the verdict rule in src/lib/providers/mock.ts and src/lib/doc-page.ts,
 * so it stays true to the real logic. "Back to results" returns to the rows.
 */
export function ScoreExplanation({ signals, onBack }: ScoreExplanationProps) {
  return (
    <section aria-label="How the score is calculated" className="flex flex-col gap-4">
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
        Back to results
      </button>

      <p className="text-body text-text-secondary">
        Each submission is judged against {signals.length} signals. The AI provider (or the
        deterministic mock used by default) reads your text against each signal&rsquo;s prompt and
        returns a score from 0 to 100, a short rationale, and — for inline signals — the exact
        phrases it flagged. Nothing here is a hard block; the scores are guidance.
      </p>

      <div className="flex flex-col gap-2">
        <h3 className="text-body-emphasis text-text-primary">The signals</h3>
        <ul className="flex flex-col gap-2">
          {signals.map((signal) => (
            <li
              key={signal.id}
              data-signal-id={signal.id}
              className="flex flex-col gap-1 rounded-card border border-border bg-surface px-3 py-2.5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="text-body-emphasis text-text-primary">{signal.name}</span>
                <span className="flex items-center gap-2 text-label-sm">
                  <span className="rounded-pill border border-border px-2 py-0.5 text-label-xs uppercase tracking-[0.05em] text-text-tertiary">
                    {signal.mode === 'inline' ? 'Inline' : 'Document-level'}
                  </span>
                  <span className="tabular-nums text-text-secondary">
                    passes at{' '}
                    <span className="text-text-primary">{signal.threshold}</span>
                  </span>
                </span>
              </div>
              <p className="text-body text-text-secondary">{signal.prompt}</p>
              <p className="text-label-sm text-text-tertiary">
                {signal.mode === 'inline'
                  ? 'Inline: judges specific phrases and marks them in the text.'
                  : 'Document-level: judges the whole concept, not individual phrases.'}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-body-emphasis text-text-primary">The overall verdict</h3>
        <p className="text-body text-text-secondary">
          A signal is flagged when it scores below its own threshold. The flag count is the number
          of flagged signals. The signals then combine into one verdict:
        </p>
        <ul className="flex flex-col gap-1.5">
          <li className="text-body text-text-secondary">
            <span className="text-pass">Looks ready</span> — no signal is below its threshold.
          </li>
          <li className="text-body text-text-secondary">
            <span className="text-risk">Not ready</span> — any Brand Safety signal is below its
            threshold, or 4 or more signals are flagged.
          </li>
          <li className="text-body text-text-secondary">
            <span className="text-minor">Needs work</span> — anything in between (at least one flag,
            but not enough to be &ldquo;Not ready&rdquo;).
          </li>
        </ul>
        {signals.some((s) => isBrandSafety(s.id)) ? (
          <p className="text-label-sm text-text-tertiary">
            Brand Safety carries extra weight: a single failing Brand Safety signal makes the whole
            verdict &ldquo;Not ready&rdquo; on its own.
          </p>
        ) : null}
      </div>
    </section>
  )
}
