"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";
import type { Project } from "@/types";
import { createStorageRepository } from "@/lib/storage";
import { Menu } from "@/components/menu";
import { cn } from "@/lib/utils";

interface ProjectSwitcherProps {
  /** The project currently being viewed; rendered as the trigger and disabled in the list. */
  currentProjectId: string;
}

/** An empty list used for the server render and the first client render. */
const NO_PROJECTS: Project[] = [];

/**
 * Breadcrumb project segment that doubles as a switcher: renders the current
 * project's name as a menu trigger (with a chevron) and, when opened, lists every
 * available project. Choosing one navigates to its library (`/p/<id>`); the current
 * project is marked and disabled.
 *
 * The project list is read from the localStorage-backed `StorageRepository` via
 * `useSyncExternalStore` (mirroring `useLibraryData`): the server and first
 * hydration render see the empty snapshot, the real client snapshot is read after
 * mount — so there is no hydration mismatch and no `setState`-in-effect. Navigation
 * uses `next/link` rows, so it works without JS and is straightforward to test.
 */
export function ProjectSwitcher({ currentProjectId }: ProjectSwitcherProps) {
  // Compute the client snapshot once. Memoising the VALUE keeps `getSnapshot`
  // referentially stable, which `useSyncExternalStore` requires to avoid a read loop.
  const clientProjects = useMemo(() => createStorageRepository().listProjects(), []);
  const getSnapshot = useCallback(() => clientProjects, [clientProjects]);
  // No external mutation source (single-tab, in-session), so `subscribe` is a no-op.
  const subscribe = useCallback(() => () => {}, []);

  const projects = useSyncExternalStore(subscribe, getSnapshot, () => NO_PROJECTS);

  const [orderedProjects, currentName] = useMemo(() => {
    const sorted = [...projects].sort((a, b) => a.name.localeCompare(b.name));
    const current = sorted.find((p) => p.id === currentProjectId);
    return [sorted, current?.name] as const;
  }, [projects, currentProjectId]);

  return (
    <Menu
      align="left"
      ariaLabel="Switch project"
      triggerClassName={cn(
        "inline-flex max-w-full items-center gap-1 rounded-control text-label-sm text-text-primary",
        "transition-colors hover:text-text-primary",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
      )}
      label={
        <>
          <span className="truncate">{currentName ?? "Project"}</span>
          <ChevronDown className="size-3.5 shrink-0 text-text-tertiary" aria-hidden="true" />
        </>
      }
    >
      {(close) =>
        orderedProjects.map((project) => {
          const isCurrent = project.id === currentProjectId;
          return (
            <Link
              key={project.id}
              role="menuitem"
              href={`/p/${project.id}`}
              aria-current={isCurrent ? "page" : undefined}
              aria-disabled={isCurrent || undefined}
              tabIndex={isCurrent ? -1 : undefined}
              onClick={(event) => {
                if (isCurrent) {
                  // Already here — don't navigate, just dismiss.
                  event.preventDefault();
                  close();
                  return;
                }
                close();
              }}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-control px-2.5 py-1.5 text-left text-label-sm transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                isCurrent
                  ? "cursor-default text-text-primary"
                  : "text-text-secondary hover:bg-panel hover:text-text-primary",
              )}
            >
              <span className="truncate">{project.name}</span>
              {isCurrent ? <Check className="size-3.5 shrink-0" aria-hidden="true" /> : null}
            </Link>
          );
        })
      }
    </Menu>
  );
}
