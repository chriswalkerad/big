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

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1800)
    return () => clearTimeout(t)
  }, [copied])

  async function copy() {
    const absolute =
      typeof window !== 'undefined' && url.startsWith('/') ? `${window.location.origin}${url}` : url
    try {
      await navigator.clipboard?.writeText(absolute)
      setCopied(true)
    } catch {
      // Clipboard blocked (permissions / insecure context); fail quietly.
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-control border border-border bg-surface px-2.5 text-label-sm text-text-secondary',
        'transition-colors hover:bg-panel hover:text-text-primary',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
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
  )
}
