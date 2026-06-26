"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { Document, Person } from "@/types";
import {
  ALL_STATUSES,
  filterDocuments,
  relativeTime,
  type StatusFilter,
} from "@/lib/library";
import { useLibraryData } from "@/lib/use-library-data";
import { Button } from "@/components/button";
import { Select, type SelectOption } from "@/components/select";
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
 * Global navigation — brand, project switching, the review inbox, and account
 * controls — lives in the persistent left rail provided by the app shell, so
 * this page renders plainly into the shell's `<main>` content column: a slim
 * header with the page's OWN title + actions (search, status filter) over a
 * hairline-divided document list. Composing a new document now lives in the
 * left rail's "Compose" item, not here. No full-bleed breakout, no top bar.
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

  const isFiltering = query.trim().length > 0 || status !== ALL_STATUSES;

  // #17: the result-count live region must stay silent on initial load and not
  // fire once per keystroke. The announcement is only set — after a short typing
  // pause — once the user has actually filtered; while not filtering it renders
  // empty (see below) so it never re-announces the full unfiltered list. The
  // effect therefore only ever schedules a non-empty update on a timer, never a
  // synchronous setState.
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    if (!isFiltering) return;
    const count = filtered.length;
    const noun = count === 1 ? "document" : "documents";
    const id = window.setTimeout(() => {
      setAnnouncement(`${count} ${noun} match your search and filter.`);
    }, 400);
    return () => window.clearTimeout(id);
  }, [isFiltering, filtered.length]);

  // WCAG 2.4.2 (Page Titled): give this route its own descriptive document
  // title once the project loads. Data is client-side localStorage, so the
  // title is synced in an effect rather than via server `generateMetadata`.
  // The loading/error states keep the static layout title (no project name yet).
  const projectName =
    snapshot.status === "ready" ? snapshot.data.project.name : null;
  useEffect(() => {
    if (projectName) document.title = `${projectName} — Big Review`;
  }, [projectName]);

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

  return (
    <div className="flex flex-col gap-8">
      {/* Slim page header in the content column: the page's own plain title +
          audience subtitle, then the row of the page's own actions. Global nav
          (brand, project switcher, inbox, account) lives in the left rail. */}
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-display text-text-primary">{project.name}</h1>
          <p className="text-body text-text-secondary">{project.audience}</p>
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
      </header>

      <div className="flex flex-col gap-4">
        {/* Announce the filtered result count to assistive tech once the user
            has filtered (search results are an async-feeling update). The text
            stays empty on load and is updated after a typing pause (see the
            debounced effect above), so it neither announces on first paint nor
            fires once per keystroke. */}
        <p aria-live="polite" className="sr-only">
          {isFiltering ? announcement : ""}
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
  const title = doc.title || "Untitled";
  const subtypeLabel = doc.subtype ? SUBTYPE_LABELS[doc.subtype] : "none";
  const statusLabel = STATUS_LABELS[doc.status];
  // #15 (WCAG 4.1.2): the row is a single <Link> whose accessible name would
  // otherwise be the bare concatenation of its columns ("…Character Concept
  // Changes Requested…") with no clue which token is the type, status, or date.
  // Compose an explicit, field-labelled accessible name so each value is heard
  // with its role; this overrides the visual text for assistive tech.
  const rowLabel = [
    title,
    `type ${subtypeLabel}`,
    `status ${statusLabel}`,
    `owner ${owner.name}`,
    `reviewer ${doc.reviewer ? doc.reviewer.name : "none"}`,
    `created ${relativeTime(doc.createdAt)}`,
    `updated ${relativeTime(doc.updatedAt)}`,
  ].join(", ");

  return (
    <Link
      href={`/p/${projectId}/d/${doc.id}`}
      aria-label={rowLabel}
      className={cn(
        // Title / Created / Subtype / Status as four aligned columns (fixed widths
        // on ≥sm keep the Created, Subtype, and Status columns lined up across
        // rows); the meta line (owner + reviewer + updated) spans the full width
        // beneath. Last two columns (subtype + status) are vertically centred.
        // Subtype/status are plain single-line text (no pill) — the columns are
        // wide enough to hold long labels ("Character Concept", "Changes
        // Requested") on ONE line, truncating with an ellipsis past that.
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-2 py-3.5 transition-colors",
        "sm:grid-cols-[minmax(0,1fr)_7rem_10rem_10rem]",
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
          indexing SUBTYPE_LABELS with null. Plain single-line text (no pill),
          truncated past the column width. */}
      <span className="hidden min-w-0 truncate whitespace-nowrap text-label-sm text-text-secondary sm:block">
        {doc.subtype ? (
          SUBTYPE_LABELS[doc.subtype]
        ) : (
          <span className="text-text-tertiary" aria-hidden="true">
            —
          </span>
        )}
      </span>
      <span className="hidden min-w-0 truncate whitespace-nowrap text-label-sm text-text-secondary sm:block">
        {STATUS_LABELS[doc.status]}
      </span>
      <div className="col-span-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-label-sm text-text-tertiary sm:col-span-4">
        {/* On mobile the dedicated columns are hidden, so surface subtype + status
            here too; ≥sm they live in their own columns above. */}
        <span className="whitespace-nowrap sm:hidden">
          {doc.subtype ? SUBTYPE_LABELS[doc.subtype] : "—"}
        </span>
        <span className="sm:hidden" aria-hidden="true">
          ·
        </span>
        <span className="whitespace-nowrap sm:hidden">
          {STATUS_LABELS[doc.status]}
        </span>
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
