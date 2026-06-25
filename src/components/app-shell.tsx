import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface AppShellProps {
  children: ReactNode;
  className?: string;
}

/**
 * The white app frame: the outer page surface plus a centered, max-width
 * `<main>` content container. It is route-agnostic and owns NO header — the
 * single slim top "action line" is rendered per page via `<TopBar>`, so this
 * shell stays a thin shared wrapper every page can rely on.
 *
 * `className` overrides the default `max-w-5xl` measure (the document page
 * widens it itself).
 */
export function AppShell({ children, className }: AppShellProps) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-app-canvas">
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
  );
}
