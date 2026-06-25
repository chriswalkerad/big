'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

// Brand illustration colors (the celebration is a brand moment, not themed UI).
const YELLOW = '#FACC15'
const INK = '#15151C'
const CURTAIN = '#7F1420' // deep theatrical velvet red
const CURTAIN_DEEP = '#4E0C14' // shadowed velvet fold
const CARPET = '#9B1C24' // red carpet
const SCRIM = 'rgba(9, 9, 13, 0.92)'

interface ThePremiereProps {
  /** When true, the celebration plays; flip back to false to dismiss. */
  show: boolean
  /** Called when the celebration finishes (auto after a beat, or on click/Escape). */
  onDone: () => void
  /** The submitted document's title, revealed under "PREMIERE". */
  title?: string
}

// Discrete paparazzi point-flashes (NOT falling particles): fixed spots that pop.
const FLASHES = [
  { left: '14%', top: '22%', delay: 2.0 },
  { left: '82%', top: '30%', delay: 2.2 },
  { left: '28%', top: '64%', delay: 2.45 },
  { left: '70%', top: '58%', delay: 2.65 },
  { left: '50%', top: '18%', delay: 2.85 },
] as const

/**
 * THE PREMIERE — a celebration concept. Two heavy theater curtains sweep in from
 * the sides and meet (closing over the screen) with brand-yellow rope-light
 * edges; a beat of anticipation; then they part dramatically to reveal a center
 * card "PREMIERE" over {title}, a red carpet sweeps toward the viewer, and a few
 * discrete paparazzi point-flashes pop. Full-screen portal overlay. Auto-
 * dismisses after a beat; click or Escape skips it. Honors prefers-reduced-
 * motion (a calm static card) and announces via aria-live.
 */
export function ThePremiere({ show, onDone, title, scrim = true }: ThePremiereProps & { scrim?: boolean }) {
  const reduce = useReducedMotion()

  // Auto-dismiss after the sequence; Escape skips.
  useEffect(() => {
    if (!show) return
    const timer = setTimeout(onDone, reduce ? 2000 : 3600)
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
          key="the-premiere"
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
            Submission confirmed. Premiere{title ? `: ${title}` : ''} — you&rsquo;re a Big Shot now.
          </p>

          {reduce ? <ReducedPremiere title={title} /> : <FullPremiere title={title} />}

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: reduce ? 0.2 : 2.6 }}
            className="absolute bottom-8 z-30 text-label-sm"
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

/** The full animated sequence: curtains close → beat → part → reveal + carpet + flashes. */
function FullPremiere({ title }: { title?: string }) {
  const velvet = `repeating-linear-gradient(90deg, ${CURTAIN} 0 14px, ${CURTAIN_DEEP} 14px 28px)`

  return (
    <>
      {/* center card — fades up under the curtains as they part */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 10 }}
        animate={{ scale: [0.9, 0.9, 1], opacity: [0, 0, 1], y: [10, 10, 0] }}
        transition={{ duration: 3.6, times: [0, 0.62, 0.78], ease: 'easeOut' }}
        className="relative z-10 select-none"
      >
        <span
          className="block font-bold uppercase tracking-[0.12em]"
          style={{ color: YELLOW, textShadow: `0 0 30px ${YELLOW}55`, fontSize: 'clamp(2.4rem, 10vw, 5rem)', lineHeight: 1 }}
        >
          Premiere
        </span>
        {title ? (
          <p
            className="mt-3 text-body-emphasis"
            style={{ color: 'rgba(255,255,255,0.92)' }}
          >
            &ldquo;{title}&rdquo;
          </p>
        ) : null}
        <p className="mt-2 text-label-sm uppercase tracking-[0.08em]" style={{ color: YELLOW }}>
          You&rsquo;re a Big Shot now
        </p>
      </motion.div>

      {/* red carpet — sweeps from the card toward the viewer (trapezoid via clip-path) */}
      <motion.div
        initial={{ scaleY: 0, opacity: 0 }}
        animate={{ scaleY: [0, 0, 1], opacity: [0, 0, 1] }}
        transition={{ duration: 3.6, times: [0, 0.68, 0.92], ease: 'easeOut' }}
        className="pointer-events-none absolute bottom-0 left-1/2 z-[5] h-[42vh] w-[80vw] origin-bottom -translate-x-1/2"
        style={{
          background: `linear-gradient(180deg, ${CARPET}, ${CURTAIN_DEEP})`,
          clipPath: 'polygon(38% 0, 62% 0, 100% 100%, 0 100%)',
          boxShadow: `0 0 40px ${INK}88`,
        }}
      />

      {/* paparazzi point-flashes — discrete pops at fixed spots (capped brightness) */}
      {FLASHES.map((f, i) => (
        <motion.span
          key={i}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.3, 0], opacity: [0, 0.85, 0] }}
          transition={{ delay: f.delay, duration: 0.5, ease: 'easeOut' }}
          className="pointer-events-none absolute z-20 block size-14 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            left: f.left,
            top: f.top,
            background: 'radial-gradient(circle, rgba(255,255,255,0.85), rgba(255,255,255,0) 68%)',
          }}
        />
      ))}

      {/* LEFT curtain — sweeps in to center, holds, parts left. Rope-light edge on the inner side. */}
      <motion.div
        initial={{ x: '-100%' }}
        animate={{ x: ['-100%', '0%', '0%', '-100%'] }}
        transition={{ duration: 3.6, times: [0, 0.28, 0.5, 0.72], ease: 'easeInOut' }}
        className="absolute inset-y-0 left-0 z-[15] w-1/2"
        style={{ background: velvet }}
      >
        <div
          className="absolute inset-y-0 right-0 w-2"
          style={{ background: YELLOW, boxShadow: `0 0 18px 2px ${YELLOW}aa` }}
        />
      </motion.div>

      {/* RIGHT curtain — mirror of the left. */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: ['100%', '0%', '0%', '100%'] }}
        transition={{ duration: 3.6, times: [0, 0.28, 0.5, 0.72], ease: 'easeInOut' }}
        className="absolute inset-y-0 right-0 z-[15] w-1/2"
        style={{ background: velvet }}
      >
        <div
          className="absolute inset-y-0 left-0 w-2"
          style={{ background: YELLOW, boxShadow: `0 0 18px 2px ${YELLOW}aa` }}
        />
      </motion.div>
    </>
  )
}

/** Calm static version for prefers-reduced-motion (still special, no motion). */
function ReducedPremiere({ title }: { title?: string }) {
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-card border-2 px-8 py-6"
      style={{ borderColor: YELLOW, background: INK }}
    >
      <span
        className="font-bold uppercase tracking-[0.12em] text-heading"
        style={{ color: YELLOW }}
      >
        Premiere
      </span>
      {title ? (
        <p className="text-body-emphasis" style={{ color: 'rgba(255,255,255,0.92)' }}>
          &ldquo;{title}&rdquo;
        </p>
      ) : null}
      <p className="text-label-sm uppercase tracking-[0.08em]" style={{ color: YELLOW }}>
        You&rsquo;re a Big Shot now
      </p>
    </div>
  )
}
