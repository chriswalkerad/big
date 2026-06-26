import type { ReactNode } from "react";
import { LeftRail, RailEdgeToggle } from "@/components/left-rail";
import { cn } from "@/lib/utils";

export interface AppShellProps {
  children: ReactNode;
  className?: string;
}

/**
 * The app frame: a flex row of the collapsible {@link LeftRail} and a centered,
 * max-width `<main>` content column. It is route-agnostic and owns NO header —
 * the single slim top "action line" is rendered per page via `<TopBar>`.
 *
 * `<LeftRail>` is a client component that reads the current route: on editor
 * routes (`/p/{id}/d/...`) it returns `null`, so the row's only child is `main`
 * (full-width, the editor's `mx-[calc(50%-50vw)]` full-bleed intact). On
 * library/settings routes it renders the rail beside the content; `main` keeps
 * its `max-w-5xl mx-auto` measure WITHIN the content column.
 *
 * `className` overrides the default `max-w-5xl` measure (the document page
 * widens it itself).
 *
 * The rail is a PERSISTENT in-flow column that PUSHES content from `sm` up; the
 * row only stacks (drawer + hamburger) below `sm`. The collapse toggle lives
 * here as a floating {@link RailEdgeToggle} pinned to the content column's left
 * edge (the rail/content boundary), not inside the rail header.
 */
export function AppShell({ children, className }: AppShellProps) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-bg sm:flex-row">
      <LeftRail />
      {/* The content column. `min-w-0` lets it shrink beside the rail without
          overflowing; `flex-1` claims the remaining width. `relative` anchors
          the floating collapse toggle to this column's left edge. When the rail
          returns null (editor routes) this column is the row's only child and
          spans the full viewport, preserving the editor full-bleed math.
          `main` keeps its own centered measure inside this column. */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        <RailEdgeToggle />
        <main
          id="main-content"
          tabIndex={-1}
          className={cn(
            "mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 focus:outline-none",
            className,
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
