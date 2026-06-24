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
  return (
    <span
      data-status={status}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill border border-border bg-panel px-2 py-0.5 text-label-sm text-text-secondary transition-colors",
        className,
      )}
    >
      <span className="size-1.5 rounded-pill bg-text-tertiary" aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  );
}
