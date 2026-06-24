"use client";

import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One node in a breadcrumb trail.
 *
 * Rendering is decided by which fields are present, in this order:
 *   - `content`  → a caller-supplied node (e.g. an interactive switcher), rendered
 *                  verbatim in the segment slot. `label` is then only its key/text.
 *   - `href`     → a `next/link` (client-side navigation).
 *   - `onClick`  → a `<button>` (in-page action, e.g. opening a popup).
 *   - none       → a plain `<span>` (a static label).
 *
 * Set `current: true` on the active/last segment to emphasise it and expose
 * `aria-current="page"` for assistive technology.
 */
export interface BreadcrumbSegment {
  /** Visible text for the segment (and a stable key, even when `content` renders). */
  label: string;
  /** Custom node rendered in place of the default label/link/button. */
  content?: ReactNode;
  /** Navigate here via `next/link` when provided. */
  href?: string;
  /** Run this when the segment is activated; renders the segment as a button. */
  onClick?: () => void;
  /** Marks the active segment (emphasised + `aria-current="page"`). */
  current?: boolean;
}

export interface BreadcrumbProps {
  /** Ordered segments, root first. */
  segments: BreadcrumbSegment[];
  /** Accessible label for the surrounding `<nav>`. Defaults to "Breadcrumb". */
  ariaLabel?: string;
  className?: string;
}

/** Shared text styling for an interactive (link/button) segment. */
const interactiveSegmentClass = cn(
  "rounded-control text-label-sm text-text-secondary transition-colors",
  "hover:text-text-primary",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
);

/**
 * Presentational breadcrumb trail. Purely driven by its `segments` prop — it
 * makes no assumptions about routes, projects, or documents, so it is safe to
 * reuse from any page. For an Account-aware trail (with the project-switcher
 * popup wired in), use `AppBreadcrumb` instead.
 */
export function Breadcrumb({ segments, ariaLabel = "Breadcrumb", className }: BreadcrumbProps) {
  return (
    <nav aria-label={ariaLabel} className={cn("min-w-0", className)}>
      <ol className="flex min-w-0 items-center gap-1.5">
        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;
          // A unique-enough key: labels can repeat, so pair with the index.
          const key = `${index}-${segment.label}`;

          return (
            <Fragment key={key}>
              <li className="flex min-w-0 items-center">
                <BreadcrumbItem segment={segment} />
              </li>
              {!isLast ? (
                <li aria-hidden="true" className="flex shrink-0 items-center">
                  <ChevronRight className="size-3.5 text-text-tertiary" />
                </li>
              ) : null}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

function BreadcrumbItem({ segment }: { segment: BreadcrumbSegment }) {
  const { label, content, href, onClick, current } = segment;

  // The active segment is emphasised and announced as the current page.
  const currentClass = "truncate text-label-sm text-text-primary";
  const ariaCurrent = current ? ("page" as const) : undefined;

  // A caller-supplied node owns its own markup (and accessibility); render it as-is.
  if (content !== undefined) {
    return <>{content}</>;
  }

  if (href) {
    return (
      <Link
        href={href}
        aria-current={ariaCurrent}
        className={cn(
          "block truncate",
          current ? currentClass : interactiveSegmentClass,
        )}
      >
        {label}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-current={ariaCurrent}
        className={cn(
          "block max-w-full truncate text-left",
          current ? currentClass : interactiveSegmentClass,
        )}
      >
        {label}
      </button>
    );
  }

  return (
    <span
      aria-current={ariaCurrent}
      className={cn(
        "block truncate text-label-sm",
        current ? "text-text-primary" : "text-text-secondary",
      )}
    >
      {label}
    </span>
  );
}
