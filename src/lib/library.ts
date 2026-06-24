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
