"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import type { AppError } from "@/lib/errors";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  /** The typed error. Its `message` is shown verbatim; `code` drives `retryable`. */
  error: AppError;
  onRetry?: () => void;
  className?: string;
  title?: string;
}

/**
 * Renders a typed AppError: the human-readable reason plus a Retry affordance
 * when the error is retryable and a handler is supplied.
 */
export function ErrorState({
  error,
  onRetry,
  className,
  title = "Something went wrong",
}: ErrorStateProps) {
  const canRetry = error.retryable && typeof onRetry === "function";

  return (
    <div
      role="alert"
      data-error-code={error.code}
      className={cn(
        "flex flex-col items-center gap-3 rounded-card border border-border bg-surface px-6 py-10 text-center",
        className,
      )}
    >
      <AlertTriangle className="size-5 text-text-tertiary" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <p className="text-body-emphasis text-text-primary">{title}</p>
        <p className="text-body text-text-secondary">{error.message}</p>
      </div>
      {canRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-control border border-border bg-panel px-3 py-1.5 text-label-sm text-text-primary transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
          Retry
        </button>
      ) : null}
    </div>
  );
}
