'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

// Brand illustration colors (the celebration is a brand moment, not themed UI).
const YELLOW = '#FACC15'
const CHARCOAL = '#15151C'
const SLATE = '#1B1B22' // chalk slate face
const CHALK = 'rgba(255,255,255,0.92)'
const SCRIM = 'rgba(9, 9, 13, 0.94)'

interface RollCameraProps {
  /** When true, the celebration plays; flip back to false to dismiss. */
  show: boolean
  /** Called when the celebration finishes (auto after a beat, or on click/Escape). */
  onDone: () => void
  /** The submitted document's title — engraved onto the slate. */
  title?: string
}

/**
 * ROLL CAMERA — a clapperboard moment. A black clapper arm hinges down and SNAPS
 * shut across the screen (a hard clack, sold by a single capped-brightness white
 * flash frame), revealing a personalized chalk slate:
 * `SCENE: {title} · TAKE 1 · "SUBMITTED."` with a brand-yellow stripe. The clapper
 * arm then lifts away. Full-screen portal overlay; auto-dismisses after a beat;
 * click or Escape skips it. Honors prefers-reduced-motion (a calm static slate)
 * and announces via aria-live.
 */
export function RollCamera({ show, onDone, title }: RollCameraProps) {
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

  const scene = title ?? 'YOUR FILM'

  return createPortal(
    <AnimatePresence>
      {show ? (
        <motion.div
          key="roll-camera"
          role="dialog"
          aria-modal="true"
          aria-label="Submission confirmed"
          onClick={onDone}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0.2 : 0.24 }}
          className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-6 px-6 text-center"
          style={{ background: SCRIM }}
        >
          {/* Screen-reader announcement — the clack is inclusive. */}
          <p className="sr-only" role="status" aria-live="assertive">
            Scene {scene}, take one. Submitted{title ? `: ${title}` : ''}.
          </p>

          {reduce ? (
            <ReducedSlate scene={scene} />
          ) : (
            <FullClapper scene={scene} />
          )}

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: reduce ? 0.2 : 1.9 }}
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

/** The full animated sequence: slate rises → clapper snaps (flash) → arm lifts. */
function FullClapper({ scene }: { scene: string }) {
  return (
    <div className="relative flex w-full max-w-xl flex-col items-center">
      {/* One-frame white flash on impact — capped brightness for photosensitivity. */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.45, 0] }}
        transition={{ delay: 0.62, duration: 0.16, times: [0, 0.2, 1] }}
        className="pointer-events-none fixed inset-0 z-[1]"
        style={{ background: '#FFFFFF' }}
      />

      {/* The slate face — rises up to be revealed under the clapper. */}
      <motion.div
        initial={{ y: 26, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.66, type: 'spring', stiffness: 380, damping: 20 }}
        className="relative w-full select-none overflow-hidden rounded-card border-2"
        style={{ background: SLATE, borderColor: CHARCOAL }}
      >
        {/* brand-yellow production stripe */}
        <div className="h-2 w-full" style={{ background: YELLOW }} />
        <div className="flex flex-col items-start gap-2 px-6 py-6 text-left">
          <SlateRow label="SCENE" value={scene} />
          <SlateRow label="TAKE" value="1" />
          <motion.span
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.0, type: 'spring', stiffness: 420, damping: 14 }}
            className="mt-1 font-bold uppercase tracking-[0.06em]"
            style={{
              color: YELLOW,
              fontSize: 'clamp(2rem, 9vw, 3.5rem)',
              lineHeight: 1,
              textShadow: `0 0 24px ${YELLOW}55`,
            }}
          >
            &ldquo;Submitted.&rdquo;
          </motion.span>
        </div>
        {/* brand-yellow production stripe (bottom) */}
        <div className="h-2 w-full" style={{ background: YELLOW }} />
      </motion.div>

      {/* The hinged clapper arm — snaps shut (rotate 2 keyframes), then lifts away. */}
      <motion.div
        aria-hidden
        initial={{ rotate: -42 }}
        animate={{ rotate: [-42, 0, 0, -52] }}
        transition={{
          duration: 1.7,
          times: [0, 0.36, 0.78, 1],
          ease: ['easeIn', 'linear', 'easeOut'],
        }}
        className="absolute left-0 right-0 top-0 flex origin-left"
        style={{ height: 28 }}
      >
        <ClapperArm />
      </motion.div>
    </div>
  )
}

/** A label/value row in chalk on the slate. */
function SlateRow({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-baseline gap-2 text-label-sm uppercase tracking-[0.08em]">
      <span style={{ color: 'rgba(255,255,255,0.5)' }}>{label}:</span>
      <span className="font-bold" style={{ color: CHALK }}>
        {value}
      </span>
    </span>
  )
}

/** The black/yellow striped clapper bar. */
function ClapperArm() {
  return (
    <div
      className="flex h-full w-full items-stretch overflow-hidden rounded-control"
      style={{ background: CHARCOAL, boxShadow: '0 8px 18px rgba(0,0,0,0.5)' }}
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <span
          key={i}
          className="h-full flex-1 origin-bottom"
          style={{
            background: i % 2 === 0 ? CHARCOAL : YELLOW,
            transform: 'skewX(-22deg)',
          }}
        />
      ))}
    </div>
  )
}

/** Calm static slate for prefers-reduced-motion (still special, no transforms). */
function ReducedSlate({ scene }: { scene: string }) {
  return (
    <div
      className="w-full max-w-xl select-none overflow-hidden rounded-card border-2"
      style={{ background: SLATE, borderColor: CHARCOAL }}
    >
      <div className="h-2 w-full" style={{ background: YELLOW }} />
      <div className="flex flex-col items-start gap-2 px-6 py-6 text-left">
        <SlateRow label="SCENE" value={scene} />
        <SlateRow label="TAKE" value="1" />
        <span
          className="mt-1 text-heading font-bold uppercase tracking-[0.06em]"
          style={{ color: YELLOW }}
        >
          &ldquo;Submitted.&rdquo;
        </span>
      </div>
      <div className="h-2 w-full" style={{ background: YELLOW }} />
    </div>
  )
}
