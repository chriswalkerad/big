"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useParams } from "next/navigation";
import {
  ChevronLeft,
  Home,
  Inbox,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  SquarePen,
  UserRound,
} from "lucide-react";
import type { Document, Person, Project } from "@/types";
import { createStorageRepository } from "@/lib/storage";
import { relativeTime, reviewQueue } from "@/lib/library";
import { useRailState } from "@/lib/use-rail-state";
import { AccountDialog } from "@/components/account-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { STATUS_LABELS } from "@/components/status-chip";
import { cn } from "@/lib/utils";

/** The seeded project the app opens inside (mirrors src/app/page.tsx). */
const SEEDED_PROJECT_ID = "proj-eloise";

/**
 * localStorage key holding the LAST project the rail was inside. Namespaced
 * under the app's `bsp:ui:` UI-preferences prefix (mirrors `bsp:ui:rail-collapsed`
 * in `use-rail-state.ts`). Persisting it lets routes WITHOUT a project id (e.g.
 * `/settings/*`) keep reflecting the project you were last in, rather than
 * silently snapping back to the seeded default.
 */
const LAST_PROJECT_KEY = "bsp:ui:last-project";

/**
 * Module-level listener set so every mounted `useCurrentProjectId` consumer
 * re-reads after any of them persists a new last-project — `useSyncExternalStore`'s
 * `subscribe` wires React to this. We also listen to the cross-tab `storage`
 * event so a change in one tab propagates. (Same pattern as `useRailState`.)
 */
const lastProjectListeners = new Set<() => void>();

function emitLastProject(): void {
  for (const listener of lastProjectListeners) listener();
}

function subscribeLastProject(onStoreChange: () => void): () => void {
  lastProjectListeners.add(onStoreChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === LAST_PROJECT_KEY) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    lastProjectListeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

function readLastProject(): string | null {
  try {
    return window.localStorage.getItem(LAST_PROJECT_KEY);
  } catch {
    // localStorage can throw (private mode, disabled); fall back to no value.
    return null;
  }
}

function writeLastProject(projectId: string): void {
  try {
    if (window.localStorage.getItem(LAST_PROJECT_KEY) === projectId) return;
    window.localStorage.setItem(LAST_PROJECT_KEY, projectId);
  } catch {
    // Persistence is best-effort; ignore write failures.
    return;
  }
  emitLastProject();
}

/** Stable empty snapshots for the server / first client render (no read loop). */
const NO_PROJECTS: Project[] = [];
const NO_DOCS: Document[] = [];

const noopSubscribe = () => () => {};

/**
 * Editor routes own the full viewport (full-bleed writing column + slide-in
 * review panel), so the rail must NOT render there. Matches the document
 * editor (`/p/{id}/d/{docId}` and its `/new`) and the reviewer view
 * (`/p/{id}/d/{docId}/review`). Library (`/p/{id}`) and settings keep the rail.
 */
function isEditorPath(pathname: string): boolean {
  return /^\/p\/[^/]+\/d\//.test(pathname);
}

/**
 * The current project the rail reflects (Home link, highlighted project, Inbox
 * count). Resolution order:
 *
 *   1. The project id in the route (`/p/{id}/…`). When present it is also
 *      PERSISTED as the last active project (see {@link LAST_PROJECT_KEY}).
 *   2. On routes WITHOUT a project id (e.g. `/settings/*`), the persisted last
 *      project — so the rail keeps reflecting the project you were last in.
 *   3. The seeded default, only if nothing has been persisted yet.
 *
 * SSR/hydration-safe: the persisted value is read via `useSyncExternalStore`
 * whose server snapshot is `null`, so the server and first client paint both
 * resolve to the seeded default; the persisted value is applied only after
 * hydration (mirrors `useRailState`'s mount gate).
 */
function useCurrentProjectId(): string {
  const params = useParams<{ projectId?: string }>();
  const pathname = usePathname();

  const routeProjectId = useMemo(() => {
    if (params?.projectId) return params.projectId;
    const match = pathname.match(/^\/p\/([^/]+)/);
    return match?.[1] ?? null;
  }, [params?.projectId, pathname]);

  // Persist the route's project id as the last active project once we are on a
  // client (post-mount), so settings/no-id routes can fall back to it.
  useEffect(() => {
    if (routeProjectId) writeLastProject(routeProjectId);
  }, [routeProjectId]);

  // Persisted last project. Server snapshot is `null` so SSR/first paint use the
  // seeded default and the stored value is applied only after hydration.
  const lastProjectId = useSyncExternalStore(
    subscribeLastProject,
    readLastProject,
    () => null,
  );

  if (routeProjectId) return routeProjectId;
  return lastProjectId ?? SEEDED_PROJECT_ID;
}

/** Read the project list from storage (mirrors ProjectSwitcher's pattern). */
function useProjects(): Project[] {
  const clientProjects = useMemo(
    () => createStorageRepository().listProjects(),
    [],
  );
  const getSnapshot = useCallback(() => clientProjects, [clientProjects]);
  return useSyncExternalStore(noopSubscribe, getSnapshot, () => NO_PROJECTS);
}

/** This project's review queue + its owner (for the inbox count and rows). */
function useProjectInbox(projectId: string): { queue: Document[]; owner: Person | null } {
  const repo = useMemo(() => createStorageRepository(), []);
  const clientDocs = useMemo(
    () => repo.listDocuments().filter((d) => d.projectId === projectId),
    [repo, projectId],
  );
  const getDocs = useCallback(() => clientDocs, [clientDocs]);
  const docs = useSyncExternalStore(noopSubscribe, getDocs, () => NO_DOCS);

  const project = useMemo(() => repo.getProject(projectId), [repo, projectId]);

  return useMemo(
    () => ({ queue: reviewQueue(docs), owner: project?.owner ?? null }),
    [docs, project],
  );
}

type RailMode = "nav" | "inbox";

/**
 * The collapsible app-wide LEFT navigation rail.
 *
 * Renders on every library/settings route as a flex sibling of the page
 * `<main>` (see `AppShell`). It returns `null` on editor routes so those pages
 * keep the full viewport.
 *
 * Two MODES (local state):
 *   - "nav"   — brand + collapse toggle · Home · Projects · Inbox · divider ·
 *               Settings · Account · Theme.
 *   - "inbox" — a back header + this project's review-queue rows, each linking
 *               to the reviewer view. "Back" returns to nav mode.
 *
 * Two WIDTHS (persisted via `useRailState`): expanded (~240px, icon + label)
 * and collapsed (~56px, icons only with a styled hover/focus {@link Tooltip}).
 * The width transition is reduced-motion-safe (the global rule in globals.css
 * neutralizes long transitions).
 *
 * RESPONSIVE MODEL. At `sm+` (≥640px, i.e. small tablets through desktop) the
 * rail is a PERSISTENT in-flow flex sibling that PUSHES the content column —
 * never an overlay — and the collapsed/expanded width applies at every one of
 * those widths (it does NOT revert to the wide base width when narrow). The
 * off-canvas drawer + backdrop are used ONLY on true narrow phones (`<sm`),
 * toggled by the slim top strip's hamburger, and the backdrop renders only
 * while the drawer is open. The collapse toggle itself lives OUTSIDE the rail
 * (a floating edge control rendered by {@link AppShell}); see {@link RailEdgeToggle}.
 */
export function LeftRail() {
  const pathname = usePathname();
  const currentProjectId = useCurrentProjectId();
  const { collapsed, expand, mounted } = useRailState();

  const [mode, setMode] = useState<RailMode>("nav");
  const [accountOpen, setAccountOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Until hydration, render the rail at its default (expanded) width so the
  // server and first client render agree; the persisted collapsed value is
  // applied once `mounted` is true. Computed before the early return so the
  // collapse→nav effect below sees it (hook order must stay stable).
  const isCollapsed = mounted && collapsed;

  // Collapsing the rail always returns it to nav mode. The inbox panel is only
  // legible at the expanded width, so a collapse (via the edge toggle, or a
  // cross-tab change) drops any open inbox back to the default nav list —
  // re-expanding then shows nav, not the inbox we just walked away from.
  // Detected as a render-time state adjustment on the collapsed transition,
  // React's endorsed alternative to an effect (no extra render pass).
  const [wasCollapsed, setWasCollapsed] = useState(isCollapsed);
  if (isCollapsed !== wasCollapsed) {
    setWasCollapsed(isCollapsed);
    if (isCollapsed && mode === "inbox") setMode("nav");
  }

  // Editor routes own the viewport — no rail. Checked AFTER hooks so the hook
  // order is stable across renders.
  if (isEditorPath(pathname)) return null;

  const closeDrawer = () => setDrawerOpen(false);

  return (
    <>
      {/* Phones (<sm): slim top strip with a hamburger that opens the drawer. */}
      <MobileStrip onOpen={() => setDrawerOpen(true)} />

      {/* Drawer backdrop — phones ONLY, and only while the drawer is open. At
          sm+ the rail is in-flow and pushes content, so there is never an
          overlay. */}
      {drawerOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={closeDrawer}
          className="fixed inset-0 z-40 cursor-default bg-text-primary/20 backdrop-blur-sm sm:hidden"
        />
      ) : null}

      <nav
        aria-label="Primary"
        data-collapsed={isCollapsed ? "true" : undefined}
        className={cn(
          // Base: a subtly-tinted panel column (bg-panel ≈ #fafafa, dark-mode
          // safe), divided from the white content area by a hairline right edge.
          // On sm+ it is a static in-flow flex sibling that pushes content;
          // below sm an off-canvas drawer.
          "flex shrink-0 flex-col border-r border-border bg-panel",
          "fixed inset-y-0 left-0 z-50 w-60 max-w-[80vw] transition-transform duration-200",
          drawerOpen ? "translate-x-0" : "-translate-x-full",
          // sm+: in-flow, no transform, width toggles between expanded/collapsed
          // at THESE widths too (no reverting to the wide base width when narrow).
          "sm:static sm:z-auto sm:max-w-none sm:translate-x-0 sm:transition-[width] sm:duration-200",
          isCollapsed ? "sm:w-14" : "sm:w-60",
        )}
      >
        {mode === "nav" ? (
          <NavMode
            collapsed={isCollapsed}
            currentProjectId={currentProjectId}
            pathname={pathname}
            onOpenInbox={() => {
              // Collapsed → expand first so the inbox rows (dropped at icon
              // width) are readable; then switch the rail into inbox mode.
              if (isCollapsed) expand();
              setMode("inbox");
            }}
            onOpenAccount={() => {
              closeDrawer();
              setAccountOpen(true);
            }}
            onNavigate={closeDrawer}
          />
        ) : (
          <InboxMode
            collapsed={isCollapsed}
            projectId={currentProjectId}
            onBack={() => setMode("nav")}
            onNavigate={closeDrawer}
          />
        )}
      </nav>

      <AccountDialog open={accountOpen} onClose={() => setAccountOpen(false)} />
    </>
  );
}

/** The slim phone-only top strip: brand mark + a hamburger that opens the drawer. */
function MobileStrip({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="sticky top-0 z-30 flex h-[46px] items-center gap-2 border-b border-border bg-bg/85 px-3 backdrop-blur sm:hidden">
      <button
        type="button"
        onClick={onOpen}
        aria-label="Open navigation"
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-control",
          "text-text-secondary transition-colors hover:bg-panel hover:text-text-primary",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
        )}
      >
        <PanelLeftOpen className="size-4" aria-hidden="true" />
      </button>
      <span className="inline-flex items-center gap-2">
        <Image
          src="/big-shot-icon.png"
          alt=""
          width={16}
          height={16}
          className="size-4 rounded-[4px]"
        />
        <span className="text-label-sm text-text-secondary">Big Review</span>
      </span>
    </div>
  );
}

interface NavModeProps {
  collapsed: boolean;
  currentProjectId: string;
  pathname: string;
  onOpenInbox: () => void;
  onOpenAccount: () => void;
  onNavigate: () => void;
}

function NavMode({
  collapsed,
  currentProjectId,
  pathname,
  onOpenInbox,
  onOpenAccount,
  onNavigate,
}: NavModeProps) {
  const projects = useProjects();
  const { queue } = useProjectInbox(currentProjectId);
  const inboxCount = queue.length;

  const orderedProjects = useMemo(
    () => [...projects].sort((a, b) => a.name.localeCompare(b.name)),
    [projects],
  );

  const homeHref = `/p/${currentProjectId}`;
  const homeActive = pathname === homeHref || pathname === "/";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Brand mark. The expanded header matches the editor TopBar's horizontal
          padding (px-4 sm:px-6) so the brand mark sits in the SAME spot whether
          or not the rail is present — it must not jump between pages. The header
          holds only the brand; the collapse toggle is a floating edge control
          rendered by AppShell, outside the rail. */}
      <div
        className={cn(
          "flex h-[46px] items-center gap-2 border-b border-border",
          collapsed ? "justify-center px-2.5" : "px-4 sm:px-6",
        )}
      >
        <Link
          href={homeHref}
          onClick={onNavigate}
          aria-label="Big Review home"
          className={cn(
            "inline-flex shrink-0 items-center rounded-control",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
          )}
        >
          <Image
            src="/big-shot-icon.png"
            alt=""
            width={16}
            height={16}
            priority
            className="size-4 rounded-[4px]"
          />
        </Link>
        {!collapsed ? (
          <span className="min-w-0 flex-1 truncate text-label-sm text-text-secondary">
            Big Review
          </span>
        ) : null}
      </div>

      {/* Scrollable nav body. */}
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        <RailLink
          href={homeHref}
          icon={<Home className="size-4" aria-hidden="true" />}
          label="Home"
          collapsed={collapsed}
          active={homeActive}
          onNavigate={onNavigate}
        />

        {/* Compose a new document. */}
        <RailLink
          href={`/p/${currentProjectId}/d/new`}
          icon={<SquarePen className="size-4" aria-hidden="true" />}
          label="Compose"
          collapsed={collapsed}
          active={false}
          onNavigate={onNavigate}
        />

        {/* Projects. */}
        <RailSectionLabel collapsed={collapsed}>Projects</RailSectionLabel>
        {orderedProjects.map((project) => (
          <RailLink
            key={project.id}
            href={`/p/${project.id}`}
            icon={
              <span
                aria-hidden="true"
                className="inline-flex size-4 items-center justify-center rounded-[4px] bg-panel text-[10px] font-medium text-text-tertiary"
              >
                {project.name.slice(0, 1).toUpperCase()}
              </span>
            }
            label={project.name}
            collapsed={collapsed}
            active={project.id === currentProjectId}
            onNavigate={onNavigate}
          />
        ))}

        {/* Inbox — switches the rail into inbox mode (does not navigate). */}
        <RailButton
          icon={<Inbox className="size-4" aria-hidden="true" />}
          label="Inbox"
          collapsed={collapsed}
          badge={inboxCount}
          onClick={onOpenInbox}
        />

        <div className="my-1.5 border-t border-border" role="separator" />

        <RailLink
          href="/settings/signals"
          icon={<Settings className="size-4" aria-hidden="true" />}
          label="Settings"
          collapsed={collapsed}
          active={pathname.startsWith("/settings")}
          onNavigate={onNavigate}
        />
        <RailButton
          icon={<UserRound className="size-4" aria-hidden="true" />}
          label="Account"
          collapsed={collapsed}
          onClick={onOpenAccount}
        />
        {collapsed ? (
          <Tooltip label="Theme">
            <ThemeToggle
              asMenuItem
              collapsed
              className={railRowClass(false, true)}
            />
          </Tooltip>
        ) : (
          <ThemeToggle asMenuItem className={railRowClass(false, false)} />
        )}
      </div>
    </div>
  );
}

interface InboxModeProps {
  collapsed: boolean;
  projectId: string;
  onBack: () => void;
  onNavigate: () => void;
}

function InboxMode({ collapsed, projectId, onBack, onNavigate }: InboxModeProps) {
  const { queue, owner } = useProjectInbox(projectId);
  const headingId = useId();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Back header. */}
      <div className="flex h-[46px] items-center gap-1 border-b border-border px-2.5">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to navigation"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-control px-1.5 py-1 text-label-sm",
            "text-text-secondary transition-colors hover:bg-panel hover:text-text-primary",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
          )}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          {!collapsed ? <span id={headingId}>Inbox</span> : null}
        </button>
      </div>

      <div
        className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2"
        aria-labelledby={collapsed ? undefined : headingId}
        aria-label={collapsed ? "Inbox" : undefined}
      >
        {queue.length === 0 ? (
          <p className="px-2.5 py-2 text-label-sm text-text-tertiary">
            {collapsed ? "—" : "No submissions to review."}
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {queue.map((doc) => (
              <li key={doc.id}>
                <Link
                  href={`/p/${projectId}/d/${doc.id}/review`}
                  onClick={onNavigate}
                  title={collapsed ? doc.title || "Untitled" : undefined}
                  className={cn(
                    "flex flex-col gap-0.5 rounded-control px-2.5 py-2 transition-colors",
                    "hover:bg-panel",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus",
                    collapsed ? "items-center" : "",
                  )}
                >
                  <span className="truncate text-body-emphasis text-text-primary">
                    {collapsed
                      ? (doc.title || "Untitled").slice(0, 1).toUpperCase()
                      : doc.title || "Untitled"}
                  </span>
                  {!collapsed ? (
                    <span className="text-label-sm text-text-tertiary">
                      {owner ? `Owner · ${owner.name} · ` : ""}
                      Reviewer · {doc.reviewer ? doc.reviewer.name : "—"} ·{" "}
                      {STATUS_LABELS[doc.status]} · {relativeTime(doc.updatedAt)}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * A small styled hover/focus tooltip for COLLAPSED rail items — white text on a
 * near-black surface (`bg-ink`/`text-ink-foreground`), positioned just to the
 * RIGHT of the icon. Replaces the native `title` attribute so the hint is
 * legibly styled and consistent across browsers.
 *
 * The trigger (its single child) and the tip share a `group` wrapper; the tip
 * is shown on `group-hover` AND `group-focus-within` (so it appears on keyboard
 * focus too). It is `aria-hidden` — the trigger already carries the label as its
 * accessible name (`aria-label`), so the tip is purely visual and must not be
 * double-announced. The fade is reduced-motion-safe via the global rule.
 */
function Tooltip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <span className="group relative flex w-full">
      {children}
      <span
        role="tooltip"
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2",
          "whitespace-nowrap rounded-control bg-ink px-2 py-1 text-label-sm text-ink-foreground shadow-sm",
          "opacity-0 transition-opacity duration-150",
          "group-hover:opacity-100 group-focus-within:opacity-100",
        )}
      >
        {label}
      </span>
    </span>
  );
}

/** Shared row class for rail items (links, buttons, the theme toggle). */
function railRowClass(active: boolean, collapsed: boolean): string {
  return cn(
    "flex w-full items-center gap-2.5 rounded-control px-2.5 py-1.5 text-left text-label-sm transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
    collapsed ? "justify-center" : "",
    // The rail itself is `bg-panel`, so active/hover lift to `bg-surface`
    // (white) to stay visible against the tinted column.
    active
      ? "bg-surface text-text-primary"
      : "text-text-secondary hover:bg-surface hover:text-text-primary",
  );
}

interface RailLinkProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
  active: boolean;
  onNavigate: () => void;
}

function RailLink({ href, icon, label, collapsed, active, onNavigate }: RailLinkProps) {
  const link = (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? label : undefined}
      className={railRowClass(active, collapsed)}
    >
      <span className="shrink-0">{icon}</span>
      {!collapsed ? <span className="min-w-0 flex-1 truncate">{label}</span> : null}
    </Link>
  );
  // Collapsed → the label is dropped, so a styled tooltip stands in for it
  // (replacing the native `title`); shown on hover AND keyboard focus.
  return collapsed ? <Tooltip label={label}>{link}</Tooltip> : link;
}

interface RailButtonProps {
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
  badge?: number;
  onClick: () => void;
}

function RailButton({ icon, label, collapsed, badge, onClick }: RailButtonProps) {
  const showBadge = typeof badge === "number" && badge > 0;
  // The badge is decorative for the a11y name (it would otherwise smear into the
  // label, e.g. "Inbox3"); the count is voiced via the button's aria-label.
  const accessibleName = showBadge ? `${label}, ${badge} awaiting review` : label;
  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-label={accessibleName}
      className={cn(railRowClass(false, collapsed), "relative")}
    >
      <span className="shrink-0">{icon}</span>
      {!collapsed ? (
        <>
          <span aria-hidden="true" className="min-w-0 flex-1 truncate">
            {label}
          </span>
          {showBadge ? (
            <span
              aria-hidden="true"
              className="inline-flex min-w-4 items-center justify-center rounded-pill bg-ink px-1 text-[10px] font-medium leading-4 text-ink-foreground"
            >
              {badge}
            </span>
          ) : null}
        </>
      ) : showBadge ? (
        <span
          aria-hidden="true"
          className="absolute right-1 top-1 inline-flex min-w-4 items-center justify-center rounded-pill bg-ink px-1 text-[10px] font-medium leading-4 text-ink-foreground"
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
  // Collapsed → label dropped; a styled tooltip stands in (hover + focus).
  return collapsed ? <Tooltip label={label}>{button}</Tooltip> : button;
}

/**
 * The collapse/expand toggle, rendered OUTSIDE the rail as a small floating edge
 * control sitting just to the RIGHT of the rail at the rail/content boundary.
 * Present in BOTH collapsed and expanded states. Rendered by {@link AppShell}
 * (a flex sibling at the top of the content column) rather than inside the rail
 * header.
 *
 * It is shown only at `sm+` — the widths where the rail is the persistent
 * in-flow collapsible column. On phones (`<sm`) the rail is a full-width drawer
 * toggled by the {@link MobileStrip} hamburger, so the edge control is hidden.
 * Returns `null` on editor routes (where the rail itself is absent).
 */
export function RailEdgeToggle() {
  const pathname = usePathname();
  const { collapsed, toggle, mounted } = useRailState();

  if (isEditorPath(pathname)) return null;

  const isCollapsed = mounted && collapsed;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isCollapsed ? "Expand navigation" : "Collapse navigation"}
      className={cn(
        // A floating control pinned to the content column's left edge (the
        // rail/content boundary), vertically near the top. `hidden sm:inline-flex`
        // keeps it off phones, where the hamburger owns the drawer.
        "absolute left-0 top-2 z-30 hidden size-7 -translate-x-1/2 items-center justify-center sm:inline-flex",
        "rounded-control border border-border bg-surface text-text-tertiary shadow-sm",
        "transition-colors hover:bg-panel hover:text-text-primary",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
      )}
    >
      {isCollapsed ? (
        <PanelLeftOpen className="size-4" aria-hidden="true" />
      ) : (
        <PanelLeftClose className="size-4" aria-hidden="true" />
      )}
    </button>
  );
}

/** A small uppercase section label, hidden when collapsed (a divider stands in). */
function RailSectionLabel({
  children,
  collapsed,
}: {
  children: React.ReactNode;
  collapsed: boolean;
}) {
  if (collapsed) {
    return <div className="my-1 border-t border-border" role="separator" />;
  }
  return (
    <p className="px-2.5 pb-0.5 pt-2.5 text-label-xs uppercase tracking-wide text-text-tertiary">
      {children}
    </p>
  );
}
