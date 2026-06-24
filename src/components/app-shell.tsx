import type { ReactNode } from "react";
import Link from "next/link";
import { Settings } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

export interface AppShellProps {
  children: ReactNode;
  className?: string;
}

/**
 * Global application chrome: a slim sticky top bar plus a centered, max-width
 * content container for the page below it.
 *
 * The top bar holds the brand/app name on the left and, on the right, a
 * Settings link (to the signal admin at `/settings/signals`) and the theme
 * toggle. Per-page breadcrumbs and actions are rendered by the pages
 * themselves (via `AppBreadcrumb`), not here, so this shell stays route-
 * agnostic and every page shares the same outer frame.
 */
export function AppShell({ children, className }: AppShellProps) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-app-canvas">
      <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href="/"
            className={cn(
              "inline-flex items-center gap-2 rounded-control text-label-sm font-medium uppercase tracking-[0.05em] text-text-secondary transition-colors",
              "hover:text-text-primary",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
            )}
          >
            {/* Decorative: the adjacent "Creative Review" text already names the
                link, so an alt here would just duplicate the accessible name. */}
            <img
              src="/big-shot-icon.png"
              alt=""
              width={28}
              height={28}
              className="size-7 rounded-[6px]"
            />
            Creative Review
          </Link>
          <nav aria-label="Primary" className="flex items-center gap-2">
            <Link
              href="/settings/signals"
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-control px-2.5",
                "border border-border bg-surface text-label-sm text-text-secondary",
                "transition-colors hover:bg-panel hover:text-text-primary",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              )}
            >
              <Settings className="size-4" aria-hidden="true" />
              <span>Settings</span>
            </Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>
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
