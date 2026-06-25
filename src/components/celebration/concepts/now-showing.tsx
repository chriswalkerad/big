'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

// Brand illustration colors (the celebration is a brand moment, not themed UI).
const YELLOW = '#FACC15'
const CHARCOAL = '#15151C'
const MARQUEE = '#1C1C24' // marquee face
const SCRIM = 'rgba(9, 9, 13, 0.95)'

const BULBS_PER_SIDE = 9

interface NowShowingProps {
  /** When true, the celebration plays; flip back to false to dismiss. */
  show: boolean
  /** Called when the celebration finishes (auto after a beat, or on click/Escape). */
  onDone: () => void
  /** The headline title — flips in on the marquee (split-flap feel). */
  title?: string
}

/**
 * NOW SHOWING — a theater marquee drops from the top with chasing border bulbs
 * (staggered), "NOW SHOWING" lights up, then `{title}` flips in with a split-flap
 * feel while two spotlights sweep behind a dark scrim. Full-screen portal overlay;
 * auto-dismisses after a beat; click or Escape skips it. Honors
 * prefers-reduced-motion (a calm static marquee) and announces via aria-live.
 */
export function NowShowing({ show, onDone, title }: NowShowingProps) {
  const reduce = useReducedMotion()

  // Auto-dismiss after the sequence; Escape skips.
  useEffect(() => {
    if (!show) return
    const timer = setTimeout(onDone, reduce ? 2000 : 3300)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDone()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', onKey)
    }
  }, [show, reduce, onDone])

  if (typeof document === 'undefined') return null

  const feature = title ?? 'YOUR FEATURE'

  return createPortal(
    <AnimatePresence>
      {show ? (
        <motion.div
          key="now-showing"
          role="dialog"
          aria-modal="true"
          aria-label="Submission confirmed"
          onClick={onDone}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0.2 : 0.28 }}
          className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-7 overflow-hidden px-6 text-center"
          style={{ background: SCRIM }}
        >
          {/* Screen-reader announcement — the marquee is inclusive. */}
          <p className="sr-only" role="status" aria-live="assertive">
            Now showing{title ? `: ${title}` : ''}. Submitted to review.
          </p>

          {reduce ? null : <SweepingSpotlights />}

          {reduce ? (
            <ReducedMarquee feature={feature} />
          ) : (
            <FullMarquee feature={feature} />
          )}

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: reduce ? 0.2 : 2.0 }}
            className="relative z-10 text-label-sm"
            style={{ color: 'rgba(255,255,255,0.55)' }}
          >
            Tap anywhere to continue
          </motion.p>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}

/** Two capped-brightness spotlights sweeping behind the dark scrim. */
function SweepingSpotlights() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {[-1, 1].map((dir) => (
        <motion.div
          key={dir}
          initial={{ rotate: dir * 22, opacity: 0 }}
          animate={{ rotate: dir * -22, opacity: 0.9 }}
          transition={{
            delay: 0.3,
            duration: 2.6,
            repeat: Infinity,
            repeatType: 'reverse',
            ease: 'easeInOut',
          }}
          className="absolute bottom-0 h-[150%] w-[44%] origin-bottom"
          style={{
            left: dir === -1 ? '6%' : 'auto',
            right: dir === 1 ? '6%' : 'auto',
            background:
              'linear-gradient(to top, rgba(250,204,21,0.16), rgba(250,204,21,0.04) 55%, transparent)',
            clipPath: 'polygon(42% 100%, 58% 100%, 100% 0%, 0% 0%)',
          }}
        />
      ))}
    </div>
  )
}

/** The full sequence: marquee drops → bulbs chase → "NOW SHOWING" → title flips. */
function FullMarquee({ feature }: { feature: string }) {
  return (
    <motion.div
      initial={{ y: '-120%' }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 220, damping: 18 }}
      className="relative z-10 w-full max-w-xl select-none rounded-card border-4"
      style={{ background: MARQUEE, borderColor: CHARCOAL, boxShadow: '0 24px 50px rgba(0,0,0,0.6)' }}
    >
      <BulbBorder animated />

      <div className="flex flex-col items-center gap-3 px-8 py-8">
        <motion.span
          initial={{ opacity: 0.2 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.4 }}
          className="text-label-sm font-bold uppercase tracking-[0.32em]"
          style={{ color: YELLOW, textShadow: `0 0 16px ${YELLOW}66` }}
        >
          Now Showing
        </motion.span>

        <SplitFlapTitle text={feature} />
      </div>
    </motion.div>
  )
}

/** The title rendered as split-flap tiles that flip in one by one. */
function SplitFlapTitle({ text }: { text: string }) {
  const chars = Array.from(text.slice(0, 24))
  return (
    <div className="flex flex-wrap items-center justify-center gap-1">
      {chars.map((ch, i) => (
        <motion.span
          key={i}
          initial={{ rotateX: 92, opacity: 0 }}
          animate={{ rotateX: 0, opacity: 1 }}
          transition={{ delay: 1.0 + i * 0.045, type: 'spring', stiffness: 460, damping: 20 }}
          className="inline-flex min-w-[0.55em] items-center justify-center rounded-control px-1 py-1 font-bold uppercase"
          style={{
            background: ch === ' ' ? 'transparent' : CHARCOAL,
            color: YELLOW,
            fontSize: 'clamp(1.4rem, 7vw, 2.6rem)',
            lineHeight: 1,
            transformOrigin: 'center',
            boxShadow: ch === ' ' ? 'none' : 'inset 0 -2px 0 rgba(0,0,0,0.4)',
          }}
        >
          {ch === ' ' ? ' ' : ch}
        </motion.span>
      ))}
    </div>
  )
}

/** Chasing bulb border around the marquee. */
function BulbBorder({ animated }: { animated: boolean }) {
  return (
    <>
      {(['top', 'bottom'] as const).map((edge) => (
        <div
          key={edge}
          aria-hidden
          className="absolute left-3 right-3 flex justify-between"
          style={{ [edge]: 6 }}
        >
          {Array.from({ length: BULBS_PER_SIDE }).map((_, i) => (
            <Bulb key={i} index={i} animated={animated} />
          ))}
        </div>
      ))}
    </>
  )
}

/** A single marquee bulb; staggered pulse gives the chase. */
function Bulb({ index, animated }: { index: number; animated: boolean }) {
  if (!animated) {
    return (
      <span
        className="block size-2 rounded-full"
        style={{ background: YELLOW, boxShadow: `0 0 8px 1px ${YELLOW}88` }}
      />
    )
  }
  return (
    <motion.span
      aria-hidden
      initial={{ opacity: 0.3 }}
      animate={{ opacity: [0.3, 1, 0.3] }}
      transition={{
        delay: 0.4 + (index % 3) * 0.12,
        duration: 0.9,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      className="block size-2 rounded-full"
      style={{ background: YELLOW, boxShadow: `0 0 8px 1px ${YELLOW}88` }}
    />
  )
}

/** Calm static marquee for prefers-reduced-motion (still special, no transforms). */
function ReducedMarquee({ feature }: { feature: string }) {
  return (
    <div
      className="relative z-10 w-full max-w-xl select-none rounded-card border-4"
      style={{ background: MARQUEE, borderColor: CHARCOAL }}
    >
      <BulbBorder animated={false} />
      <div className="flex flex-col items-center gap-3 px-8 py-8">
        <span
          className="text-label-sm font-bold uppercase tracking-[0.32em]"
          style={{ color: YELLOW }}
        >
          Now Showing
        </span>
        <span
          className="text-heading font-bold uppercase"
          style={{ color: YELLOW, lineHeight: 1.05 }}
        >
          {feature}
        </span>
      </div>
    </div>
  )
}
