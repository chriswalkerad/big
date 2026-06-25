'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

// Brand illustration colors (the celebration is a brand moment, not themed UI).
const YELLOW = '#FACC15'
const CHARCOAL = '#15151C'
const BRASS = '#C9A24B' // Walk-of-Fame star plate
const BRASS_HI = '#F0D98A' // brass highlight
const TERRAZZO = '#3A2A2A' // plaque slab around the star
const SCRIM = 'rgba(9, 9, 13, 0.95)'

interface StarIsBornProps {
  /** When true, the celebration plays; flip back to false to dismiss. */
  show: boolean
  /** Called when the celebration finishes (auto after a beat, or on click/Escape). */
  onDone: () => void
  /** The honoree's name — engraved on the star. Falls back to "YOUR NAME". */
  title?: string
}

/**
 * A STAR IS BORN — the screen dims, a spotlight cone swings in, and a brass
 * Walk-of-Fame star drops into it with a clunk, engraved with `{title}` (fallback
 * "YOUR NAME") above a small "BIG SHOT PICTURES". A plaque reads "A new name on the
 * wall." Full-screen portal overlay; auto-dismisses after a beat; click or Escape
 * skips it. Honors prefers-reduced-motion (a calm static star) and announces via
 * aria-live.
 */
export function StarIsBorn({ show, onDone, title, scrim = true }: StarIsBornProps & { scrim?: boolean }) {
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

  const name = title ?? 'YOUR NAME'

  return createPortal(
    <AnimatePresence>
      {show ? (
        <motion.div
          key="star-is-born"
          role="dialog"
          aria-modal="true"
          aria-label="Submission confirmed"
          onClick={onDone}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0.2 : 0.3 }}
          className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-7 px-6 text-center"
          style={{ background: scrim ? SCRIM : 'transparent' }}
        >
          {/* Screen-reader announcement — the spotlight is inclusive. */}
          <p className="sr-only" role="status" aria-live="assertive">
            A star is born. {name} — a new name on the wall.
          </p>

          {reduce ? (
            <ReducedStar name={name} />
          ) : (
            <FullStar name={name} />
          )}

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: reduce ? 0.2 : 2.0 }}
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

/** The full sequence: spotlight cone swings in → brass star drops → plaque. */
function FullStar({ name }: { name: string }) {
  return (
    <div className="relative flex flex-col items-center gap-6">
      {/* Spotlight cone — swings in from upper-left, soft capped-brightness glow. */}
      <motion.div
        aria-hidden
        initial={{ rotate: -28, opacity: 0 }}
        animate={{ rotate: 0, opacity: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 80, damping: 16 }}
        className="pointer-events-none absolute -top-24 left-1/2 z-0 h-[140%] w-[120%] origin-top -translate-x-1/2"
        style={{
          background:
            'radial-gradient(60% 80% at 50% 0%, rgba(250,204,21,0.22), rgba(250,204,21,0.06) 45%, transparent 70%)',
          clipPath: 'polygon(38% 0%, 62% 0%, 100% 100%, 0% 100%)',
        }}
      />

      {/* The star plate — drops in with a clunk (low-damping spring overshoot). */}
      <motion.div
        initial={{ y: -120, opacity: 0, scale: 0.85 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ delay: 0.7, type: 'spring', stiffness: 300, damping: 12 }}
        className="relative z-10 flex flex-col items-center justify-center rounded-card"
        style={{
          width: 'min(78vw, 320px)',
          aspectRatio: '1 / 1',
          background: TERRAZZO,
          boxShadow: '0 18px 40px rgba(0,0,0,0.55)',
        }}
      >
        <WalkOfFameStar />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-4 text-center">
          <span
            className="font-bold uppercase tracking-[0.06em]"
            style={{
              color: CHARCOAL,
              fontSize: 'clamp(1.1rem, 5.5vw, 1.9rem)',
              lineHeight: 1.05,
            }}
          >
            {name}
          </span>
          <span
            className="text-label-sm uppercase tracking-[0.16em]"
            style={{ color: 'rgba(21,21,28,0.7)' }}
          >
            Big Shot Pictures
          </span>
        </div>
      </motion.div>

      {/* The brass plaque caption. */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.45 }}
        className="rounded-control px-4 py-2 text-label-sm font-bold uppercase tracking-[0.08em]"
        style={{ background: YELLOW, color: CHARCOAL }}
      >
        A new name on the wall.
      </motion.div>
    </div>
  )
}

/** The engraved five-point brass star backplate. */
function WalkOfFameStar() {
  return (
    <svg
      viewBox="0 0 200 200"
      className="absolute inset-0 h-full w-full"
      aria-hidden
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="sib-brass" cx="0.42" cy="0.36" r="0.75">
          <stop offset="0" stopColor={BRASS_HI} />
          <stop offset="0.65" stopColor={BRASS} />
          <stop offset="1" stopColor="#9C7A2E" />
        </radialGradient>
      </defs>
      <polygon
        points="100,12 122,74 188,74 135,114 154,178 100,138 46,178 65,114 12,74 78,74"
        fill="url(#sib-brass)"
        stroke="#7C5E22"
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Calm static star for prefers-reduced-motion (still special, no transforms). */
function ReducedStar({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-center gap-5">
      <div
        className="relative flex items-center justify-center rounded-card"
        style={{
          width: 'min(70vw, 260px)',
          aspectRatio: '1 / 1',
          background: TERRAZZO,
        }}
      >
        <WalkOfFameStar />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-4 text-center">
          <span
            className="text-heading font-bold uppercase tracking-[0.06em]"
            style={{ color: CHARCOAL, lineHeight: 1.05 }}
          >
            {name}
          </span>
          <span
            className="text-label-sm uppercase tracking-[0.16em]"
            style={{ color: 'rgba(21,21,28,0.7)' }}
          >
            Big Shot Pictures
          </span>
        </div>
      </div>
      <span
        className="rounded-control px-4 py-2 text-label-sm font-bold uppercase tracking-[0.08em]"
        style={{ background: YELLOW, color: CHARCOAL }}
      >
        A new name on the wall.
      </span>
    </div>
  )
}
