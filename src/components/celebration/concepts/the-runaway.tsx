'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { FlashMascot } from '../flash-mascot'

// Brand illustration colors (the celebration is a brand moment, not themed UI).
const YELLOW = '#FACC15'
const INK = '#15151C'
const SCRIM = 'rgba(9, 9, 13, 0.92)'

interface TheRunawayProps {
  /** When true, the celebration plays; flip back to false to dismiss. */
  show: boolean
  /** Called when the celebration finishes (auto after a beat, or on click/Escape). */
  onDone: () => void
  /** The submitted document's title, shown on the placard. */
  title?: string
}

/**
 * THE RUNAWAY — a celebration concept. FLASH (the spotlight mascot) SPRINTS in
 * from off-screen left across the lower third, trailing a yellow speed-streak,
 * skids to a stop center, plants a "SUBMITTED!" placard, throws a thumbs-up, and
 * a speech pop reads "YOU'RE A BIG SHOT NOW!" — then sprints off-screen right
 * (the placard lingers, then lifts away). Full-screen portal overlay. Auto-
 * dismisses after a beat; click or Escape skips it. Honors prefers-reduced-
 * motion (a calm static card) and announces via aria-live.
 */
export function TheRunaway({ show, onDone, title, scrim = true }: TheRunawayProps & { scrim?: boolean }) {
  const reduce = useReducedMotion()

  // Auto-dismiss after the sequence; Escape skips.
  useEffect(() => {
    if (!show) return
    const timer = setTimeout(onDone, reduce ? 2000 : 3400)
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
          key="the-runaway"
          role="dialog"
          aria-modal="true"
          aria-label="Submission confirmed"
          onClick={onDone}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0.2 : 0.28 }}
          className="fixed inset-0 z-[70] flex flex-col items-center justify-center overflow-hidden px-6 text-center"
          style={{ background: scrim ? SCRIM : 'transparent' }}
        >
          {/* Screen-reader announcement — the WOOO is inclusive. */}
          <p className="sr-only" role="status" aria-live="assertive">
            Submission confirmed. You&rsquo;re a Big Shot now{title ? `: ${title}` : ''}.
          </p>

          {reduce ? <ReducedRunaway title={title} /> : <FullRunaway title={title} />}

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: reduce ? 0.2 : 2.4 }}
            className="absolute bottom-8 text-label-sm"
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

/** The full animated sequence: sprint in → skid + placard + pop → sprint out. */
function FullRunaway({ title }: { title?: string }) {
  return (
    <div className="relative flex h-full w-full items-end justify-center pb-[18vh]">
      {/* yellow speed-streak — rushes in behind FLASH, then fades */}
      <motion.div
        initial={{ x: '-60vw', opacity: 0, scaleX: 0.4 }}
        animate={{
          x: ['-60vw', '0vw', '0vw', '70vw'],
          opacity: [0, 0.9, 0.5, 0],
          scaleX: [0.4, 1, 0.8, 1.4],
        }}
        transition={{ duration: 3.2, times: [0, 0.28, 0.72, 1], ease: 'easeInOut' }}
        className="pointer-events-none absolute bottom-[12vh] left-1/2 h-3 w-[42vw] -translate-x-1/2 rounded-pill"
        style={{
          background: `linear-gradient(90deg, transparent, ${YELLOW})`,
          boxShadow: `0 0 22px 2px ${YELLOW}55`,
        }}
      />

      {/* FLASH — sprints in from the left, skids center, sprints off right.
          x is a tween (multi-keyframe), so NO spring here. */}
      <motion.div
        initial={{ x: '-70vw', rotate: -8 }}
        animate={{ x: ['-70vw', '2vw', '-1vw', '0vw', '80vw'], rotate: [-8, 6, -2, 0, 10] }}
        transition={{
          duration: 3.2,
          // sprint in fast, skid/settle in the middle, sprint out fast
          times: [0, 0.26, 0.34, 0.5, 1],
          ease: ['easeIn', 'easeOut', 'easeOut', 'easeIn'],
        }}
        className="relative z-10"
      >
        <FlashMascot className="h-36 w-auto sm:h-44" />

        {/* speech pop — "YOU'RE A BIG SHOT NOW!" appears during the skid */}
        <motion.div
          initial={{ scale: 0, opacity: 0, y: 10 }}
          animate={{ scale: [0, 0, 1, 1, 0], opacity: [0, 0, 1, 1, 0] }}
          transition={{ duration: 3.2, times: [0, 0.38, 0.46, 0.78, 0.86], ease: 'easeOut' }}
          className="absolute -right-4 -top-6 origin-bottom-left rounded-card px-3 py-2 text-label-sm font-bold uppercase tracking-[0.04em]"
          style={{ background: YELLOW, color: INK, boxShadow: `0 6px 20px ${INK}55` }}
        >
          You&rsquo;re a Big Shot now!
        </motion.div>
      </motion.div>

      {/* SUBMITTED! placard — planted on the skid, lingers, then lifts away */}
      <motion.div
        initial={{ y: 80, opacity: 0, rotate: -6 }}
        animate={{
          y: [80, 80, 0, 0, -120],
          opacity: [0, 0, 1, 1, 0],
          rotate: [-6, -6, -4, -4, -10],
        }}
        transition={{ duration: 3.4, times: [0, 0.34, 0.46, 0.82, 1], ease: 'easeOut' }}
        className="pointer-events-none absolute bottom-[10vh] left-1/2 z-0 -translate-x-1/2 select-none"
      >
        <div
          className="rounded-card border-2 px-6 py-3 text-center"
          style={{ background: INK, borderColor: YELLOW, boxShadow: `0 0 28px ${YELLOW}44` }}
        >
          <span
            className="block font-bold uppercase tracking-[0.06em]"
            style={{ color: YELLOW, fontSize: 'clamp(1.6rem, 6vw, 3rem)', lineHeight: 1 }}
          >
            Submitted!
          </span>
          {title ? (
            <span className="mt-1 block text-label-sm" style={{ color: 'rgba(255,255,255,0.82)' }}>
              &ldquo;{title}&rdquo;
            </span>
          ) : null}
        </div>
        {/* little post the placard is planted on */}
        <div className="mx-auto h-10 w-2 rounded-b-pill" style={{ background: YELLOW }} />
      </motion.div>
    </div>
  )
}

/** Calm static version for prefers-reduced-motion (still special, no motion). */
function ReducedRunaway({ title }: { title?: string }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <FlashMascot className="h-32 w-auto" />
      <span
        className="font-bold uppercase tracking-[0.06em] text-heading"
        style={{ color: YELLOW }}
      >
        Submitted!
      </span>
      <p className="text-body-emphasis" style={{ color: 'rgba(255,255,255,0.92)' }}>
        You&rsquo;re a Big Shot now{title ? ` — &ldquo;${title}&rdquo; is in` : ''}.
      </p>
    </div>
  )
}
