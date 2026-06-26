// Pure, unit-testable logic for the document library screen. No React, no
// storage, no DOM — just the search/filter transform the list view applies to a
// set of documents. Kept here (not inline in the page) so the rules can be
// tested directly. See specs/bsp-frontend-build-spec.md (screen 1).

import type { Document, SubmissionStatus } from "@/types";

/** "All statuses" sentinel for the status filter dropdown. */
export const ALL_STATUSES = "all" as const;

export type StatusFilter = SubmissionStatus | typeof ALL_STATUSES;

export interface DocumentFilter {
  /** Free-text query matched against title AND body (case-insensitive). */
  query?: string;
  /** Status to keep, or `"all"` to keep every status. */
  status?: StatusFilter;
}

/**
 * Filter documents by a free-text query (full-text over title and body) and a
 * status. Both are optional; an empty/whitespace query and an `"all"` (or
 * absent) status are no-ops. Pure: returns a new array, never mutates input.
 */
export function filterDocuments(
  docs: readonly Document[],
  filter: DocumentFilter = {},
): Document[] {
  const query = filter.query?.trim().toLowerCase() ?? "";
  const status = filter.status ?? ALL_STATUSES;

  return docs.filter((doc) => {
    if (status !== ALL_STATUSES && doc.status !== status) {
      return false;
    }
    if (query.length > 0) {
      const haystack = `${doc.title}\n${doc.body}`.toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }
    return true;
  });
}

/**
 * The submission statuses that mean a document is sitting in a reviewer's queue,
 * awaiting their attention. A `draft` has not been submitted; `changes_requested`
 * and `approved` are terminal-for-the-reviewer outcomes (the ball is back with the
 * author or the work is done). So only `submitted` and `in_review` are "awaiting
 * review". Derived directly from `SubmissionStatus`.
 */
const AWAITING_REVIEW_STATUSES: ReadonlySet<SubmissionStatus> = new Set<SubmissionStatus>([
  "submitted",
  "in_review",
]);

/**
 * The reviewer's inbox for a SINGLE project: the documents that have been
 * submitted and are still awaiting a reviewer's attention (status `submitted` or
 * `in_review`) AND have a reviewer assigned. Pure: returns a new array, never
 * mutates input.
 *
 * Scope is intentionally the current project — the library is per-project, so the
 * caller passes that project's documents. A cross-project inbox (one queue across
 * every project a person reviews) is a future extension; it would live a layer up
 * (over the full document set), not here.
 */
export function reviewQueue(docs: readonly Document[]): Document[] {
  return docs.filter(
    (doc) => doc.reviewer != null && AWAITING_REVIEW_STATUSES.has(doc.status),
  );
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/**
 * Format an ISO timestamp as a short relative string ("just now", "3h ago",
 * "2d ago"). Beyond a week it falls back to a localized date. `now` is injectable
 * so the output is deterministic in tests. Pure.
 */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";

  const diff = now - then;
  if (diff < MINUTE) return "just now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < WEEK) return `${Math.floor(diff / DAY)}d ago`;

  return new Date(then).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
