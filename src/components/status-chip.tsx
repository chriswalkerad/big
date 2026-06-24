"use client";

import { motion, useReducedMotion } from "motion/react";
import type { SubmissionStatus } from "@/types";
import { cn } from "@/lib/utils";

/** Human-readable labels for each submission status (also used by filters). */
export const STATUS_LABELS: Record<SubmissionStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  in_review: "In Review",
  changes_requested: "Changes Requested",
  approved: "Approved",
};

export const STATUS_ORDER: SubmissionStatus[] = [
  "draft",
  "submitted",
  "in_review",
  "changes_requested",
  "approved",
];

interface StatusChipProps {
  status: SubmissionStatus;
  className?: string;
}

/**
 * Neutral status pill. Per the design tokens spec the product uses no chromatic
 * color outside highlights/bars, so statuses are distinguished by label, not hue.
 */
export function StatusChip({ status, className }: StatusChipProps) {
  const reduceMotion = useReducedMotion();
  return (
    <span
      data-status={status}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill border border-border bg-panel px-2 py-0.5 text-label-sm text-text-secondary transition-colors",
        className,
      )}
    >
      <span className="size-1.5 rounded-pill bg-text-tertiary" aria-hidden="true" />
      {/* A subtle pop on status change; the key re-mounts the label per status. */}
      <motion.span
        key={status}
        initial={reduceMotion ? false : { scale: 0.9, opacity: 0.4 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 26 }}
      >
        {STATUS_LABELS[status]}
      </motion.span>
    </span>
  );
}
