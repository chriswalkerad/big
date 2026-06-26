"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * localStorage key holding the left-rail collapsed flag. Namespaced under the
 * app's `bsp:ui:` UI-preferences prefix so it survives independently of the
 * theme store.
 */
const RAIL_COLLAPSED_KEY = "bsp:ui:rail-collapsed";

/**
 * Module-level listener set so every mounted `useRailState` consumer re-reads
 * after any of them toggles — `useSyncExternalStore`'s `subscribe` wires React
 * to this. We also listen to the cross-tab `storage` event so a change in one
 * tab propagates. The snapshot is computed from localStorage directly.
 */
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  // Cross-tab sync: another tab writing the key fires `storage` here.
  const onStorage = (event: StorageEvent) => {
    if (event.key === RAIL_COLLAPSED_KEY) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(RAIL_COLLAPSED_KEY) === "true";
  } catch {
    // localStorage can throw (private mode, disabled). Default to expanded.
    return false;
  }
}

/** The empty-subscribe + true/false snapshot mount probe (mirrors theme-toggle). */
const emptySubscribe = () => () => {};

export interface RailState {
  /** Whether the rail is collapsed to its icon-only width. */
  collapsed: boolean;
  /** Toggle collapsed ⇄ expanded and persist the new value. */
  toggle: () => void;
  /**
   * False during SSR/first client render, true after hydration. Use it to
   * render a stable placeholder and avoid a hydration mismatch from the
   * persisted value.
   */
  mounted: boolean;
}

/**
 * Collapsed-state store for the left rail. The value is persisted under
 * `bsp:ui:rail-collapsed` in localStorage and shared across every consumer via
 * a module-level listener set, so toggling in one place updates all.
 *
 * Reads go through `useSyncExternalStore`: the server snapshot is always
 * `false` (expanded), and the real client value is read after mount. `mounted`
 * is exposed (same `useSyncExternalStore` true/false probe as `theme-toggle`)
 * so callers can hold a stable placeholder until hydration.
 */
export function useRailState(): RailState {
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false);

  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const toggle = useCallback(() => {
    try {
      const next = !readCollapsed();
      window.localStorage.setItem(RAIL_COLLAPSED_KEY, String(next));
    } catch {
      // Persistence is best-effort; ignore write failures.
    }
    emit();
  }, []);

  return { collapsed, toggle, mounted };
}
