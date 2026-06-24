"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import type { Document, SubmissionStatus } from "@/types";
import {
  ALL_STATUSES,
  filterDocuments,
  relativeTime,
  type StatusFilter,
} from "@/lib/library";
import { useLibraryData } from "@/lib/use-library-data";
import { AppBreadcrumb } from "@/components/app-breadcrumb";
import { STATUS_LABELS, STATUS_ORDER } from "@/components/status-chip";
import { SUBTYPE_LABELS } from "@/components/subtype-chip";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { cn } from "@/lib/utils";

/**
 * Document library route — `/p/[projectId]`. `params` is a Promise in Next 16;
 * since this is a Client Component we unwrap it with React's `use()` (the
 * async/await form is server-only), then hand the plain id to `LibraryView`.
 * Keeping the data/UI in `LibraryView` (a string prop, no Suspense) makes it
 * directly testable.
 */
export default function LibraryPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  return <LibraryView projectId={projectId} />;
}

/**
 * The library screen: a filterable list (rows, not a board) of the project's
 * documents with full-text search and a status filter. The project and its
 * documents are read from the localStorage-backed `StorageRepository` through
 * `useLibraryData` (a `useSyncExternalStore` wrapper), which renders a loading
 * snapshot on the server / first client paint and the real data after mount.
 */
export function LibraryView({ projectId }: { projectId: string }) {
  const { snapshot, reload } = useLibraryData(projectId);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>(ALL_STATUSES);

  const documents = snapshot.status === "ready" ? snapshot.data.documents : null;
  const filtered = useMemo(
    () => (documents ? filterDocuments(documents, { query, status }) : []),
    [documents, query, status],
  );

  if (snapshot.status === "loading") {
    return (
      <div className="flex flex-col gap-4">
        <LoadingState rows={2} label="Loading library…" />
        <LoadingState rows={5} className="mt-4" label="Loading documents…" />
      </div>
    );
  }

  if (snapshot.status === "error") {
    return (
      <ErrorState
        error={snapshot.error}
        title="Couldn't open the library"
        onRetry={reload}
      />
    );
  }

  const { project } = snapshot.data;
  const isFiltering = query.trim().length > 0 || status !== ALL_STATUSES;

  return (
    <div className="flex flex-col gap-6">
      <AppBreadcrumb
        segments={[{ label: project.name, current: true }]}
        currentProjectId={projectId}
      />

      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-heading text-text-primary">{project.name}</h1>
            <p className="text-body text-text-secondary">{project.audience}</p>
          </div>
          <Link
            href={`/p/${projectId}/d/new`}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-control px-3",
              "border border-border bg-text-primary text-label-sm font-medium text-bg",
              "transition-[transform,opacity] hover:opacity-90 active:scale-[0.98]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
            )}
          >
            <Plus className="size-4" aria-hidden="true" />
            New
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-tertiary"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title and body…"
              aria-label="Search documents"
              className={cn(
                "h-9 w-full rounded-control border border-border bg-surface pl-9 pr-3",
                "text-body text-text-primary placeholder:text-text-tertiary",
                "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              )}
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            aria-label="Filter by status"
            className={cn(
              "h-9 shrink-0 rounded-control border border-border bg-surface px-3",
              "text-label-sm text-text-secondary",
              "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
            )}
          >
            <option value={ALL_STATUSES}>All statuses</option>
            {STATUS_ORDER.map((s: SubmissionStatus) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Announce the filtered result count to assistive tech as the user types or
          changes the status filter (search results are an async-feeling update). */}
      <p aria-live="polite" className="sr-only">
        {isFiltering
          ? `${filtered.length} ${filtered.length === 1 ? "document" : "documents"} match your search and filter.`
          : `${filtered.length} ${filtered.length === 1 ? "document" : "documents"}.`}
      </p>

      {filtered.length === 0 ? (
        <EmptyState
          title="No matching documents"
          description={
            isFiltering
              ? "No documents match your search and filter. Try clearing them."
              : "This project has no documents yet."
          }
          action={
            isFiltering ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setStatus(ALL_STATUSES);
                }}
                className={cn(
                  "inline-flex h-8 items-center rounded-control border border-border bg-panel px-3",
                  "text-label-sm text-text-primary transition-colors hover:bg-surface",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                )}
              >
                Clear filters
              </button>
            ) : undefined
          }
        />
      ) : (
        <ul className="flex flex-col rounded-card border border-border bg-surface">
          {filtered.map((doc, index) => (
            <li key={doc.id} className={index > 0 ? "border-t border-border" : undefined}>
              <DocumentRow projectId={projectId} doc={doc} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DocumentRow({ projectId, doc }: { projectId: string; doc: Document }) {
  return (
    <Link
      href={`/p/${projectId}/d/${doc.id}`}
      className={cn(
        // Title / Subtype / Status as three aligned columns (fixed widths on ≥sm
        // keep the Subtype and Status columns lined up across rows); the meta line
        // spans the full width beneath.
        "grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1 px-4 py-3 transition-colors",
        "sm:grid-cols-[minmax(0,1fr)_8.5rem_10rem]",
        "hover:bg-panel",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent",
      )}
    >
      <span className="col-span-2 min-w-0 truncate text-body-emphasis text-text-primary sm:col-span-1">
        {doc.title || "Untitled"}
      </span>
      <span className="text-label-sm text-text-secondary">{SUBTYPE_LABELS[doc.subtype]}</span>
      <span className="text-label-sm text-text-secondary">{STATUS_LABELS[doc.status]}</span>
      <div className="col-span-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-label-sm text-text-tertiary sm:col-span-3">
        <span>By {doc.createdBy}</span>
        {doc.reviewer ? (
          <>
            <span aria-hidden="true">·</span>
            <span>Reviewer: {doc.reviewer}</span>
          </>
        ) : null}
        <span aria-hidden="true">·</span>
        <span>Updated {relativeTime(doc.updatedAt)}</span>
      </div>
    </Link>
  );
}
