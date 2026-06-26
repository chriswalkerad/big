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

/** Shared text styling for an interactive (link/button) segment.
 *  De-emphasised: `text-label-sm` (12px) but `font-normal` to drop the scale's
 *  baked-in 500 weight, in the muted `text-text-tertiary` tier so the whole
 *  trail recedes vs the page heading. Clears AA on the gray app canvas
 *  (#6b6b73 on #f1f1f3 = 4.68:1); brightens to `text-text-primary` on hover. */
const interactiveSegmentClass = cn(
  "rounded-control text-label-sm font-normal text-text-tertiary transition-colors",
  "hover:text-text-primary",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
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
                  <ChevronRight className="size-3 text-text-tertiary" />
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

  // The active (current) segment is announced as the current page but stays
  // de-emphasised: `font-normal` (no scale weight) in the muted secondary tier,
  // so the whole breadcrumb recedes vs the page heading rather than competing
  // with it. `text-text-secondary` still clears AA (5.7:1 on the app canvas).
  const currentClass = "truncate text-label-sm font-normal text-text-secondary";
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
        "block truncate text-label-sm font-normal",
        // De-emphasised trail: `font-normal` drops the scale's 500 weight on
        // every segment, and all segments stay muted — non-current in the
        // tertiary tier, the current one in the secondary tier — so the trail
        // recedes vs the page heading.
        current ? "text-text-secondary" : "text-text-tertiary",
      )}
    >
      {label}
    </span>
  );
}
