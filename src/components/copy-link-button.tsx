'use client'

import { useEffect, useState } from 'react'
import { Check, Link2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CopyLinkButtonProps {
  /** Absolute or relative URL to copy. */
  url: string
  className?: string
  /** Optional label override (default "Copy link" / "Copied"). */
  label?: string
}

/**
 * Copies a URL to the clipboard and confirms with a transient "Copied" state. Used as
 * the share affordance for the `/review` link. Resolves a relative URL against the
 * current origin so the copied value is shareable.
 */
export function CopyLinkButton({ url, className, label = 'Copy link' }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false)
  // Surfaced when the clipboard write fails (permissions / insecure context) so the
  // failure is announced rather than silent.
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1800)
    return () => clearTimeout(t)
  }, [copied])

  useEffect(() => {
    if (!failed) return
    const t = setTimeout(() => setFailed(false), 3000)
    return () => clearTimeout(t)
  }, [failed])

  async function copy() {
    const absolute =
      typeof window !== 'undefined' && url.startsWith('/') ? `${window.location.origin}${url}` : url
    try {
      await navigator.clipboard?.writeText(absolute)
      setFailed(false)
      setCopied(true)
    } catch {
      // Clipboard blocked (permissions / insecure context): announce the failure
      // rather than failing silently.
      setCopied(false)
      setFailed(true)
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={copy}
        // No static aria-label: the visible text ("Copy link" → "Copied") IS the
        // accessible name, so a state change is announced when focus is on it (4.1.3).
        className={cn(
          'inline-flex h-8 items-center gap-1.5 rounded-control border border-border bg-surface px-2.5 text-label-sm text-text-secondary',
          'transition-colors hover:bg-panel hover:text-text-primary',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
          className,
        )}
      >
        {copied ? (
          <Check className="size-3.5 text-pass" aria-hidden="true" />
        ) : (
          <Link2 className="size-3.5" aria-hidden="true" />
        )}
        <span>{copied ? 'Copied' : label}</span>
      </button>
      {/* Polite live region: announces the transient "Copied" / failure outcome even
          when focus is not on the button. */}
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? 'Link copied to clipboard' : failed ? 'Copy failed — copy the link manually' : ''}
      </span>
      {failed ? (
        <span className="text-label-sm text-risk-text" aria-hidden="true">
          Copy failed
        </span>
      ) : null}
    </span>
  )
}
