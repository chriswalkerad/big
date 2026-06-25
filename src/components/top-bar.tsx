import type { ReactNode } from "react";
import Link from "next/link";
import { MoreHorizontal, Settings } from "lucide-react";
import { Menu } from "@/components/menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

export interface TopBarProps {
  /**
   * The page's breadcrumb trail, rendered on the LEFT after the brand mark
   * (typically an `AppBreadcrumb`). Optional — a bare page may omit it.
   */
  breadcrumb?: ReactNode;
  /**
   * Page-level actions, rendered on the RIGHT before the global overflow menu
   * (e.g. a primary `Button`, a `CopyLinkButton`). Optional.
   */
  actions?: ReactNode;
  className?: string;
}

/**
 * The single slim top "action line" shared app-wide (Notion-style ~46px line).
 *
 * Layout:
 *   LEFT  — a small decorative brand mark + the page `breadcrumb`.
 *   RIGHT — the page `actions` slot, then a global overflow `⋯` menu holding
 *           Settings (→ `/settings/signals`) and the theme toggle.
 *
 * It is `sticky top-0` with a single hairline bottom border on a white (token)
 * background. Pages render their own `<TopBar>` just below the app frame's
 * `<main>` start; the app shell deliberately owns no header.
 *
 * Compose from a page:
 * ```tsx
 * <TopBar
 *   breadcrumb={<AppBreadcrumb segments={[{ label: doc.title, current: true }]} />}
 *   actions={<Button>Run review</Button>}
 * />
 * ```
 */
export function TopBar({ breadcrumb, actions, className }: TopBarProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur",
        className,
      )}
    >
      <div className="flex h-[46px] w-full items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link
            href="/"
            aria-label="Creative Review home"
            className={cn(
              "inline-flex shrink-0 items-center rounded-control",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
            )}
          >
            {/* Decorative: the link's aria-label already names it. */}
            <img
              src="/big-shot-icon.png"
              alt=""
              width={16}
              height={16}
              className="size-4 rounded-[4px]"
            />
          </Link>
          {breadcrumb ? <div className="min-w-0">{breadcrumb}</div> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          <Menu
            ariaLabel="More options"
            align="right"
            triggerClassName={cn(
              "inline-flex size-7 items-center justify-center rounded-control text-text-secondary",
              "transition-colors hover:bg-panel hover:text-text-primary",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
            )}
            label={<MoreHorizontal className="size-4" aria-hidden="true" />}
          >
            {(close) => (
              <>
                <Link
                  href="/settings/signals"
                  role="menuitem"
                  onClick={close}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-control px-2.5 py-1.5 text-left text-label-sm",
                    "text-text-secondary transition-colors hover:bg-panel hover:text-text-primary",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  )}
                >
                  <Settings className="size-4" aria-hidden="true" />
                  <span>Settings</span>
                </Link>
                {/* The theme toggle keeps its own button role; wrapped so it sits
                    as a row in the overflow menu. */}
                <div className="flex items-center justify-between gap-2 rounded-control px-2.5 py-1.5 text-label-sm text-text-secondary">
                  <span>Theme</span>
                  <ThemeToggle />
                </div>
              </>
            )}
          </Menu>
        </div>
      </div>
    </header>
  );
}
