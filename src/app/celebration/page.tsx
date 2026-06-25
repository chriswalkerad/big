'use client'

import { useState, type ComponentType } from 'react'
import { SubmissionCelebration } from '@/components/celebration/submission-celebration'
import { RollCamera } from '@/components/celebration/concepts/roll-camera'
import { StarIsBorn } from '@/components/celebration/concepts/star-is-born'
import { NowShowing } from '@/components/celebration/concepts/now-showing'
import { TheRunaway } from '@/components/celebration/concepts/the-runaway'
import { ThePremiere } from '@/components/celebration/concepts/the-premiere'
import { cn } from '@/lib/utils'

/** The uniform shape every celebration overlay implements. */
type CelebrationOverlay = ComponentType<{ show: boolean; onDone: () => void; title?: string }>

interface Concept {
  key: string
  name: string
  tagline: string
  Comp: CelebrationOverlay
  shipped?: boolean
}

const CONCEPTS: Concept[] = [
  { key: 'greenlight', name: 'The Greenlight', tagline: 'Studio lights slam red → red → YELLOW into a "GREENLIT." stamp, then FLASH pops up.', Comp: SubmissionCelebration, shipped: true },
  { key: 'roll-camera', name: 'Roll Camera', tagline: 'A clapperboard SNAPS shut across the screen → a personalized "take" slate.', Comp: RollCamera },
  { key: 'star-is-born', name: 'A Star Is Born', tagline: 'A spotlight drops a brass Walk-of-Fame star — engraved with your name.', Comp: StarIsBorn },
  { key: 'now-showing', name: 'Now Showing', tagline: 'A theater marquee drops; your title flips up in lights.', Comp: NowShowing },
  { key: 'the-runaway', name: 'The Runaway', tagline: 'FLASH sprints across trailing a yellow streak, plants a "SUBMITTED!" sign.', Comp: TheRunaway },
  { key: 'the-premiere', name: 'The Premiere', tagline: 'Theater curtains close, then part to reveal your premiere + red carpet.', Comp: ThePremiere },
]

/**
 * Dev-facing gallery to preview the six "WOOO" celebration concepts before we commit
 * to polishing them. Not linked from the product nav — reach it at /celebration. Each
 * card's "Play" triggers the concept's overlay; they all respect prefers-reduced-motion.
 */
export default function CelebrationGallery() {
  const [playing, setPlaying] = useState<string | null>(null)
  const [title, setTitle] = useState('Eloise and the Midnight Room-Service Caper')

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-label-xs font-medium uppercase tracking-[0.08em] text-text-tertiary">Preview gallery</p>
        <h1 className="text-heading text-text-primary">The “WOOO!” concepts</h1>
        <p className="text-body text-text-secondary">
          Six takes on the moment a submission is confirmed. Click <span className="text-text-primary">Play</span> to
          watch each, then tell me which to polish. The Greenlight is the one currently wired to Confirm submission.
        </p>
      </header>

      <label className="flex flex-col gap-1.5">
        <span className="text-label-sm text-text-secondary">Sample doc title (used in the animations)</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-9 w-full rounded-control border border-border bg-surface px-3 text-body text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </label>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {CONCEPTS.map((c) => (
          <li
            key={c.key}
            className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className="inline-flex items-center gap-2 text-body-emphasis text-text-primary">
                  {c.name}
                  {c.shipped ? (
                    <span className="rounded-pill border border-pass px-1.5 py-0.5 text-label-xs uppercase tracking-[0.05em] text-pass">
                      Live
                    </span>
                  ) : null}
                </span>
                <span className="text-label-sm text-text-secondary">{c.tagline}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPlaying(c.key)}
              className={cn(
                'inline-flex h-8 w-fit items-center gap-1.5 rounded-control bg-accent px-3 text-label-sm font-medium text-bg',
                'transition-[transform,opacity] hover:opacity-90 active:scale-[0.98]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              )}
            >
              ▶ Play
            </button>
          </li>
        ))}
      </ul>

      {CONCEPTS.map((c) => (
        <c.Comp
          key={c.key}
          show={playing === c.key}
          onDone={() => setPlaying(null)}
          title={title || 'Untitled'}
        />
      ))}
    </div>
  )
}
