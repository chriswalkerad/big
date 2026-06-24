"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AccountDialogProps {
  /** Whether the dialog is shown. */
  open: boolean;
  /** Called when the user dismisses the dialog (Escape, backdrop, or close button). */
  onClose: () => void;
}

/**
 * Lightweight, accessible modal dialog for the "Account" breadcrumb stub.
 *
 * Hand-built with design tokens (no shadcn / Radix) because the shadcn CLI is
 * unreliable under Tailwind v4 + Next 16 in this repo. It provides the basics:
 *   - `role="dialog"` + `aria-modal` with a labelled title and description.
 *   - Dismiss via the close button, a backdrop click, or the Escape key.
 *   - Focus moves to the dialog on open and returns to the trigger on close.
 *
 * It explains that, in a fuller product, this is where you would switch
 * projects or manage the account — the feature itself is intentionally a stub.
 */
export function AccountDialog({ open, onClose }: AccountDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // Remember what was focused before opening so we can restore it on close.
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      // Restore focus to the trigger that opened the dialog.
      previouslyFocused.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:items-center"
      // Backdrop click closes; clicks inside the panel are stopped below.
      onMouseDown={onClose}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-text-primary/40 backdrop-blur-[1px]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
        className={cn(
          "relative z-10 w-full max-w-sm rounded-card border border-border bg-surface p-5 shadow-lg",
          "focus-visible:outline-none",
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-title text-text-primary">
            Account
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={cn(
              "-mr-1 -mt-1 inline-flex size-7 shrink-0 items-center justify-center rounded-control",
              "text-text-secondary transition-colors hover:bg-panel hover:text-text-primary",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
            )}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <p id={descriptionId} className="mt-2 text-body text-text-secondary">
          This would let you switch projects or manage the account. It is a stub
          for this build — there is only one seeded project right now.
        </p>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "inline-flex items-center justify-center rounded-control px-3 py-1.5",
              "bg-accent text-label-sm text-bg transition-opacity hover:opacity-90",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
            )}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
