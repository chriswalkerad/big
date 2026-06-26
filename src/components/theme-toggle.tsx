"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  /** Render as a full-width "<icon> Theme" menu row (matches the other overflow-menu items). */
  asMenuItem?: boolean;
  /**
   * Icon-only form of the menu row (only meaningful with `asMenuItem`): drops
   * the "Theme" text label, leaving just the centered sun/moon icon. Used by the
   * collapsed left rail (the label is supplied by the rail's hover tooltip).
   */
  collapsed?: boolean;
  /** Called after toggling when rendered as a menu item (e.g. to close the menu). */
  onSelect?: () => void;
}

const emptySubscribe = () => () => {};

/** True on the client (after hydration), false during SSR/first render. */
function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

/**
 * Accessible light/dark toggle. Reads and sets the active theme via
 * next-themes (which persists the choice). Renders a stable placeholder until
 * mounted to avoid a hydration mismatch, since the resolved theme is only
 * known on the client.
 */
export function ThemeToggle({
  className,
  asMenuItem = false,
  collapsed = false,
  onSelect,
}: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();

  const isDark = resolvedTheme === "dark";

  // Overflow-menu row form: "<icon> Theme", styled identically to the Settings
  // item. When `collapsed`, the text label is dropped (icon-only, centered) —
  // the rail supplies the label via its hover tooltip.
  if (asMenuItem) {
    const menuClassName = cn(
      "flex w-full items-center gap-2 rounded-control px-2.5 py-1.5 text-left text-label-sm",
      "text-text-secondary transition-colors hover:bg-panel hover:text-text-primary",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
      className,
    );
    if (!mounted) {
      return (
        <button type="button" role="menuitem" className={menuClassName} aria-hidden="true" tabIndex={-1}>
          <Sun className="size-4" aria-hidden="true" />
          {!collapsed ? <span>Theme</span> : null}
        </button>
      );
    }
    return (
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          setTheme(isDark ? "light" : "dark");
          onSelect?.();
        }}
        className={menuClassName}
        aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      >
        {isDark ? (
          <Sun className="size-4" aria-hidden="true" />
        ) : (
          <Moon className="size-4" aria-hidden="true" />
        )}
        {!collapsed ? <span>Theme</span> : null}
      </button>
    );
  }

  const buttonClassName = cn(
    "inline-flex h-8 w-8 items-center justify-center rounded-control",
    "border border-border bg-surface text-text-secondary",
    "transition-colors hover:bg-panel hover:text-text-primary",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
    className,
  );

  if (!mounted) {
    // Placeholder keeps layout stable and avoids rendering theme-dependent
    // markup before the client knows the resolved theme.
    return (
      <button
        type="button"
        className={buttonClassName}
        aria-hidden="true"
        tabIndex={-1}
      >
        <Sun className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={buttonClassName}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
    >
      {isDark ? (
        <Sun className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  );
}
