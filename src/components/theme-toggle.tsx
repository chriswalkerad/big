"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
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
export function ThemeToggle({ className }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();

  const isDark = resolvedTheme === "dark";

  const buttonClassName = cn(
    "inline-flex h-8 w-8 items-center justify-center rounded-control",
    "border border-border bg-surface text-text-secondary",
    "transition-colors hover:bg-panel hover:text-text-primary",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
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
