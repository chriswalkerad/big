import type { SubmissionStatus } from "@/types";

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
