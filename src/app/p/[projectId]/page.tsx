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
import { TopBar } from "@/components/top-bar";
import { Button, buttonClass } from "@/components/button";
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
 *
 * Chrome is the shared minimal/Notion frame: the slim white `<TopBar>` carries
 * the breadcrumb (with the project switcher) on the left and the **New** ink
 * button on the right; the page body is an all-white column with a large quiet
 * title and a hairline-divided document list (no boxy cards).
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

  // The New action is a navigation link styled as the ink primary button; it
  // sits in the TopBar's actions slot on every state so the chrome stays stable.
  const newAction = (
    <Link href={`/p/${projectId}/d/new`} className={buttonClass("ink")}>
      <Plus className="size-4" aria-hidden="true" />
      New
    </Link>
  );

  if (snapshot.status === "loading") {
    return (
      <>
        <TopBar actions={newAction} />
        <div className="flex flex-col gap-4 py-8">
          <LoadingState rows={2} label="Loading library…" />
          <LoadingState rows={5} className="mt-4" label="Loading documents…" />
        </div>
      </>
    );
  }

  if (snapshot.status === "error") {
    return (
      <>
        <TopBar actions={newAction} />
        <div className="py-8">
          <ErrorState
            error={snapshot.error}
            title="Couldn't open the library"
            onRetry={reload}
          />
        </div>
      </>
    );
  }

  const { project } = snapshot.data;
  const isFiltering = query.trim().length > 0 || status !== ALL_STATUSES;

  return (
    <>
      <TopBar
        breadcrumb={
          <AppBreadcrumb
            segments={[{ label: project.name, current: true }]}
            currentProjectId={projectId}
          />
        }
        actions={newAction}
      />

      <div className="flex flex-col gap-8 py-8">
        <header className="flex flex-col gap-1.5">
          <h1 className="text-display text-text-primary">{project.name}</h1>
          <p className="text-body text-text-secondary">{project.audience}</p>
        </header>

        <div className="flex flex-col gap-4">
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

          {/* Announce the filtered result count to assistive tech as the user types
              or changes the status filter (search results are an async-feeling
              update). */}
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
                  <Button
                    variant="default"
                    onClick={() => {
                      setQuery("");
                      setStatus(ALL_STATUSES);
                    }}
                  >
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          ) : (
            // Clean rows separated by hairline dividers — no boxy card frame.
            <ul className="flex flex-col border-t border-border">
              {filtered.map((doc) => (
                <li key={doc.id} className="border-b border-border">
                  <DocumentRow projectId={projectId} doc={doc} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
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
        "grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1 px-2 py-3.5 transition-colors",
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
