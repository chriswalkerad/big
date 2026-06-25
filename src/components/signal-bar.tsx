import { cn } from '@/lib/utils'
import { BAR_TONE_BG, barFillPercent, barTone } from '@/lib/doc-page'

interface SignalBarProps {
  /** Signal score, 0-100. */
  score: number
  /** The signal's own pass threshold (drives the fill color). */
  threshold: number
  /** Max score (default 100). */
  max?: number
  className?: string
}

/**
 * A single proportional fill bar. Width = score/max; fill color is green/amber/red
 * relative to the signal's OWN threshold (see `barTone`). The track is neutral; only
 * the fill carries the functional severity color, per the design-tokens spec.
 */
export function SignalBar({ score, threshold, max = 100, className }: SignalBarProps) {
  const tone = barTone(score, threshold)
  const width = barFillPercent(score, max)

  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-pill bg-panel', className)}
      role="meter"
      aria-valuenow={score}
      aria-valuemin={0}
      aria-valuemax={max}
      data-tone={tone}
    >
      <div
        className={cn('h-full rounded-pill transition-[width] duration-300 ease-out', BAR_TONE_BG[tone])}
        style={{ width: `${width}%` }}
      />
    </div>
  )
}
