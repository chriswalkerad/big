"use client";

import { use, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Search, SquarePen } from "lucide-react";
import type { Document, Person } from "@/types";
import {
  ALL_STATUSES,
  filterDocuments,
  relativeTime,
  reviewQueue,
  type StatusFilter,
} from "@/lib/library";
import { useLibraryData } from "@/lib/use-library-data";
import { ProjectSwitcher } from "@/components/project-switcher";
import { TopBar } from "@/components/top-bar";
import { ReviewInbox } from "@/components/review-inbox";
import { Button, buttonClass } from "@/components/button";
import { Select, type SelectOption } from "@/components/select";
import { Badge } from "@/components/badge";
import { STATUS_LABELS, STATUS_ORDER } from "@/components/status-chip";
import { SUBTYPE_LABELS } from "@/components/subtype-chip";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { cn } from "@/lib/utils";

/**
 * Options for the status filter `Select`: the "All" sentinel first, then every
 * submission status in display order. The sentinel label is just "All" (the
 * bordered control already reads as a status filter via its aria-label).
 */
const STATUS_FILTER_OPTIONS: SelectOption<StatusFilter>[] = [
  { value: ALL_STATUSES, label: "All" },
  ...STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
];

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
  const owner = snapshot.status === "ready" ? snapshot.data.project.owner : null;
  const filtered = useMemo(
    () => (documents ? filterDocuments(documents, { query, status }) : []),
    [documents, query, status],
  );
  // The reviewer inbox = this project's docs awaiting review (submitted/in_review
  // with a reviewer). Empty until data is ready, so the button shows no badge then.
  const queue = useMemo(
    () => (documents ? reviewQueue(documents) : []),
    [documents],
  );

  // The TopBar actions slot, stable across every state so the chrome doesn't jump:
  // the reviewer INBOX (left) then the icon-only ink "New" pencil (compose a doc).
  const actions = (
    <>
      <ReviewInbox projectId={projectId} queue={queue} owner={owner} />
      <Link
        href={`/p/${projectId}/d/new`}
        aria-label="New document"
        title="New document"
        className={buttonClass("ghost", "px-2")}
      >
        <SquarePen className="size-4" aria-hidden="true" />
      </Link>
    </>
  );

  if (snapshot.status === "loading") {
    return (
      <LibraryShell topBar={<TopBar actions={actions} />}>
        <div className="flex flex-col gap-4">
          <LoadingState rows={2} label="Loading library…" />
          <LoadingState rows={5} className="mt-4" label="Loading documents…" />
        </div>
      </LibraryShell>
    );
  }

  if (snapshot.status === "error") {
    return (
      <LibraryShell topBar={<TopBar actions={actions} />}>
        <ErrorState
          error={snapshot.error}
          title="Couldn't open the library"
          onRetry={reload}
        />
      </LibraryShell>
    );
  }

  const { project } = snapshot.data;
  const isFiltering = query.trim().length > 0 || status !== ALL_STATUSES;

  return (
    <LibraryShell topBar={<TopBar actions={actions} />}>
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-1.5">
          {/* The page title IS the project switcher: the big project name doubles
              as the trigger that opens the project list. */}
          <h1 className="text-display text-text-primary">
            <ProjectSwitcher currentProjectId={projectId} variant="title" />
          </h1>
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
                placeholder="Find anything in this project…"
                aria-label="Search documents"
                className={cn(
                  "h-9 w-full rounded-control border border-border bg-surface pl-9 pr-3",
                  "text-body text-text-primary placeholder:text-text-tertiary",
                  "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                )}
              />
            </div>
            <Select
              value={status}
              onChange={setStatus}
              options={STATUS_FILTER_OPTIONS}
              variant="bordered"
              ariaLabel="Filter by status"
              align="right"
              triggerClassName="shrink-0"
            />
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
                  <DocumentRow projectId={projectId} doc={doc} owner={project.owner} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </LibraryShell>
  );
}

/**
 * Page frame for the library. Breaks OUT of the AppShell `<main>` measure +
 * padding using the SAME full-bleed technique as the document page
 * (`mx-[calc(50%-50vw)]` spans the full viewport width; `-my-6` cancels the
 * shell's vertical padding) so the slim `<TopBar>` sits flush to the top and
 * spans the FULL viewport width — pixel-consistent with the document page's
 * bar. The page's own measure (`max-w-5xl`) + horizontal padding + a top
 * measure are then re-applied to the content BELOW the bar, so the document
 * list keeps its current width.
 */
function LibraryShell({
  topBar,
  children,
}: {
  topBar: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-[calc(50%-50vw)] -my-6">
      {topBar}
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        {children}
      </div>
    </div>
  );
}

function DocumentRow({
  projectId,
  doc,
  owner,
}: {
  projectId: string;
  doc: Document;
  owner: Person;
}) {
  return (
    <Link
      href={`/p/${projectId}/d/${doc.id}`}
      className={cn(
        // Title / Created / Subtype / Status as four aligned columns (fixed widths
        // on ≥sm keep the Created, Subtype, and Status columns lined up across
        // rows); the meta line (owner + reviewer + updated) spans the full width
        // beneath. Last two columns (subtype + status) are vertically centred.
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-2 py-3.5 transition-colors",
        "sm:grid-cols-[minmax(0,1fr)_7rem_8.5rem_8rem]",
        "hover:bg-panel",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus",
      )}
    >
      <span className="col-span-2 min-w-0 self-center truncate text-body-emphasis text-text-primary sm:col-span-1">
        {doc.title || "Untitled"}
      </span>
      {/* Created — hidden on mobile (folds into the meta line below), shown ≥sm. */}
      <span className="hidden text-label-sm text-text-tertiary sm:block">
        {relativeTime(doc.createdAt)}
      </span>
      {/* Subtype is nullable: render a muted em dash when absent rather than
          indexing SUBTYPE_LABELS with null. */}
      <span className="hidden sm:block">
        {doc.subtype ? (
          <Badge variant="subtype">{SUBTYPE_LABELS[doc.subtype]}</Badge>
        ) : (
          <span className="text-label-sm text-text-tertiary" aria-hidden="true">
            —
          </span>
        )}
      </span>
      <span className="hidden sm:block">
        <Badge variant="status" dot>
          {STATUS_LABELS[doc.status]}
        </Badge>
      </span>
      <div className="col-span-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-label-sm text-text-tertiary sm:col-span-4">
        {/* On mobile the dedicated columns are hidden, so surface subtype + status
            here too; ≥sm they live in their own columns above. */}
        <span className="sm:hidden">
          {doc.subtype ? SUBTYPE_LABELS[doc.subtype] : "—"}
        </span>
        <span className="sm:hidden" aria-hidden="true">
          ·
        </span>
        <span className="sm:hidden">{STATUS_LABELS[doc.status]}</span>
        <span className="sm:hidden" aria-hidden="true">
          ·
        </span>
        {/* Owner is always present; reviewer is set at submission (drafts show "—"). */}
        <span>Owner: {owner.name}</span>
        <span aria-hidden="true">·</span>
        <span>Reviewer: {doc.reviewer ? doc.reviewer.name : "—"}</span>
        {/* Created has its own column ≥sm; only fold it into the meta on mobile. */}
        <span className="sm:hidden" aria-hidden="true">
          ·
        </span>
        <span className="sm:hidden">Created {relativeTime(doc.createdAt)}</span>
        <span aria-hidden="true">·</span>
        <span>Updated {relativeTime(doc.updatedAt)}</span>
      </div>
    </Link>
  );
}
