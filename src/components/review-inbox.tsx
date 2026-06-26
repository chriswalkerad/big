"use client";

import Link from "next/link";
import { Inbox } from "lucide-react";
import type { Document, Person } from "@/types";
import { relativeTime } from "@/lib/library";
import { Menu } from "@/components/menu";
import { buttonClass } from "@/components/button";
import { STATUS_LABELS } from "@/components/status-chip";
import { cn } from "@/lib/utils";

export interface ReviewInboxProps {
  /** The project these documents belong to (links target `/p/{projectId}/…`). */
  projectId: string;
  /** Documents awaiting review (already filtered by `reviewQueue`). */
  queue: Document[];
  /** The project owner, shown on each row (null until data is ready). */
  owner: Person | null;
}

/**
 * The reviewer INBOX: an icon button that opens a popover listing this project's
 * documents awaiting review (the `queue`, already filtered by `reviewQueue`). Each
 * row links to the document's read/reviewer view at `/p/{projectId}/d/{docId}/review`.
 * A small count badge appears when the queue is non-empty. Built on the shared `Menu`
 * so it inherits roving focus, Escape, and outside-click dismissal.
 *
 * Used in BOTH the library TopBar and the document-page TopBar so a reviewer/author
 * can pop the inbox open from anywhere. Scope is the current project only (the library
 * is per-project). A cross-project inbox is a future extension — see `reviewQueue` in
 * `lib/library.ts`.
 */
export function ReviewInbox({ projectId, queue, owner }: ReviewInboxProps) {
  const count = queue.length;
  return (
    <Menu
      ariaLabel="Review inbox"
      align="right"
      triggerClassName={buttonClass("ghost", "relative px-2")}
      label={
        <>
          <Inbox className="size-4" aria-hidden="true" />
          {count > 0 ? (
            <span
              aria-label={`${count} awaiting review`}
              className={cn(
                "absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-pill px-1",
                "bg-ink text-[10px] font-medium leading-4 text-ink-foreground",
              )}
            >
              {count}
            </span>
          ) : null}
        </>
      }
    >
      {(close) => (
        <div className="w-72 max-w-[min(20rem,calc(100vw-2rem))]">
          {count === 0 ? (
            <p className="px-2.5 py-2 text-label-sm text-text-tertiary">
              No submissions to review.
            </p>
          ) : (
            <ul className="flex flex-col">
              {queue.map((doc) => {
                const title = doc.title || "Untitled";
                const reviewerName = doc.reviewer ? doc.reviewer.name : "none";
                // The visible meta is a "·"-separated run, which a screen reader
                // reads as one undifferentiated string ("Owner · Ada · Reviewer
                // · …"). Compose a clean, labelled accessible name on the row and
                // mark the visible meta `aria-hidden` so it is not re-announced.
                // Visible text is unchanged.
                const ownerPart = owner ? `Owner ${owner.name}. ` : "";
                const accessibleName =
                  `${title}. ${ownerPart}Reviewer ${reviewerName}. ` +
                  `${STATUS_LABELS[doc.status]}. Updated ${relativeTime(doc.updatedAt)}.`;
                return (
                  <li key={doc.id}>
                    <Link
                      href={`/p/${projectId}/d/${doc.id}/review`}
                      role="menuitem"
                      onClick={close}
                      aria-label={accessibleName}
                      className={cn(
                        "flex flex-col gap-0.5 rounded-control px-2.5 py-2 transition-colors",
                        "hover:bg-panel",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className="truncate text-body-emphasis text-text-primary"
                      >
                        {title}
                      </span>
                      <span
                        aria-hidden="true"
                        className="text-label-sm text-text-tertiary"
                      >
                        {owner ? `Owner · ${owner.name} · ` : ""}
                        Reviewer · {doc.reviewer ? doc.reviewer.name : "—"} ·{" "}
                        {STATUS_LABELS[doc.status]} · {relativeTime(doc.updatedAt)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </Menu>
  );
}
