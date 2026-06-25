'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { FlashMascot } from './flash-mascot'

// Brand illustration colors (the celebration is a brand moment, not themed UI).
const YELLOW = '#FACC15'
const RED = '#EF4444'
const SCRIM = 'rgba(9, 9, 13, 0.92)'

interface SubmissionCelebrationProps {
  /** When true, the celebration plays; flip back to false to dismiss. */
  show: boolean
  /** Called when the celebration finishes (auto after a beat, or on click/Escape). */
  onDone: () => void
  /** The submitted document's title, shown under the stamp. */
  title?: string
}

/**
 * THE GREENLIGHT — the "WOOOO!" moment when an author confirms a submission. A
 * full-screen portal overlay: studio lights flash red → red → brand-yellow, a
 * "GREENLIT." stamp slams in, and FLASH (the spotlight mascot) pops up with
 * "YOU'RE A BIG SHOT NOW!". Auto-dismisses after a beat; click or Escape skips it.
 * Honors prefers-reduced-motion (a calm static card) and announces via aria-live.
 */
export function SubmissionCelebration({ show, onDone, title, scrim = true }: SubmissionCelebrationProps & { scrim?: boolean }) {
  const reduce = useReducedMotion()

  // Auto-dismiss after the sequence; Escape skips.
  useEffect(() => {
    if (!show) return
    const timer = setTimeout(onDone, reduce ? 2000 : 3200)
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

  return createPortal(
    <AnimatePresence>
      {show ? (
        <motion.div
          key="celebration"
          role="dialog"
          aria-modal="true"
          aria-label="Submission confirmed"
          onClick={onDone}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0.2 : 0.28 }}
          className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-6 px-6 text-center"
          style={{ background: scrim ? SCRIM : 'transparent' }}
        >
          {/* Screen-reader announcement — the WOOO is inclusive. */}
          <p className="sr-only" role="status" aria-live="assertive">
            Submission confirmed. Greenlit and sent to review{title ? `: ${title}` : ''}.
          </p>

          {reduce ? (
            <ReducedCelebration title={title} />
          ) : (
            <FullCelebration title={title} />
          )}

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: reduce ? 0.2 : 1.6 }}
            className="text-label-sm"
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

/** The full animated sequence: lights → stamp → mascot. */
function FullCelebration({ title }: { title?: string }) {
  const lights = [RED, RED, YELLOW]
  return (
    <>
      {/* studio lights: red, red, GREENLIGHT (yellow) */}
      <div className="flex items-center gap-4">
        {lights.map((color, i) => (
          <motion.span
            key={i}
            initial={{ scale: 0, opacity: 0.2 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              delay: 0.15 + i * 0.28,
              // The greenlight (i===2) uses a low-damping spring so it overshoots
              // and "slams" in; the red lights pop in with a quick tween.
              type: i === 2 ? 'spring' : 'tween',
              stiffness: 620,
              damping: i === 2 ? 9 : 14,
              duration: 0.3,
            }}
            className="block size-5 rounded-full"
            style={{
              background: color,
              boxShadow: `0 0 24px 4px ${color}`,
            }}
          />
        ))}
      </div>

      {/* GREENLIT. stamp — slams in */}
      <motion.div
        initial={{ scale: 1.8, opacity: 0, rotate: -10 }}
        animate={{ scale: 1, opacity: 1, rotate: -5 }}
        transition={{ delay: 0.95, type: 'spring', stiffness: 420, damping: 13 }}
        className="select-none"
      >
        <span
          className="block text-display font-bold uppercase tracking-[0.04em]"
          style={{ color: YELLOW, textShadow: `0 0 30px ${YELLOW}66`, fontSize: 'clamp(3rem, 12vw, 6rem)', lineHeight: 1 }}
        >
          Greenlit.
        </span>
      </motion.div>

      {title ? (
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.25 }}
          className="text-body-emphasis"
          style={{ color: 'rgba(255,255,255,0.92)' }}
        >
          &ldquo;{title}&rdquo; is in — sent to review.
        </motion.p>
      ) : null}

      {/* FLASH pops up with a shout */}
      <motion.div
        initial={{ scale: 0.4, y: 60, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ delay: 1.2, type: 'spring', stiffness: 360, damping: 16 }}
        className="relative mt-2 flex items-end gap-3"
      >
        <FlashMascot className="h-28 w-auto sm:h-32" />
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 1.5, type: 'spring', stiffness: 500, damping: 18 }}
          className="mb-6 rounded-card px-3 py-2 text-label-sm font-bold uppercase tracking-[0.04em]"
          style={{ background: YELLOW, color: '#15151C' }}
        >
          You&rsquo;re a Big Shot now!
        </motion.div>
      </motion.div>
    </>
  )
}

/** Calm static version for prefers-reduced-motion (still special, no motion). */
function ReducedCelebration({ title }: { title?: string }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <FlashMascot className="h-28 w-auto" />
      <span
        className="text-heading font-bold uppercase tracking-[0.04em]"
        style={{ color: YELLOW }}
      >
        Greenlit.
      </span>
      <p className="text-body-emphasis" style={{ color: 'rgba(255,255,255,0.92)' }}>
        You&rsquo;re a Big Shot now{title ? ` — &ldquo;${title}&rdquo; sent to review` : ''}.
      </p>
    </div>
  )
}
