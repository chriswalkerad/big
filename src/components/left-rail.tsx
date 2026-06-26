"use client";

import {
  useCallback,
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

/** Pull the current project id from `/p/{id}/…`, else the seeded fallback. */
function useCurrentProjectId(): string {
  const params = useParams<{ projectId?: string }>();
  const pathname = usePathname();
  return useMemo(() => {
    if (params?.projectId) return params.projectId;
    const match = pathname.match(/^\/p\/([^/]+)/);
    return match?.[1] ?? SEEDED_PROJECT_ID;
  }, [params?.projectId, pathname]);
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
 * and collapsed (~56px, icons only with `title`/aria tooltips). The width
 * transition is reduced-motion-safe (the global rule in globals.css neutralizes
 * long transitions).
 *
 * Below `lg` the rail is an off-canvas drawer toggled by a slim top strip's
 * hamburger; the page content is full-width.
 */
export function LeftRail() {
  const pathname = usePathname();
  const currentProjectId = useCurrentProjectId();
  const { collapsed, toggle, mounted } = useRailState();

  const [mode, setMode] = useState<RailMode>("nav");
  const [accountOpen, setAccountOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Editor routes own the viewport — no rail. Checked AFTER hooks so the hook
  // order is stable across renders.
  if (isEditorPath(pathname)) return null;

  // Until hydration, render the rail at its default (expanded) width so the
  // server and first client render agree; the persisted collapsed value is
  // applied once `mounted` is true.
  const isCollapsed = mounted && collapsed;

  const closeDrawer = () => setDrawerOpen(false);

  return (
    <>
      {/* Mobile (<lg): slim top strip with a hamburger that opens the drawer. */}
      <MobileStrip onOpen={() => setDrawerOpen(true)} />

      {/* Mobile drawer backdrop. */}
      {drawerOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={closeDrawer}
          className="fixed inset-0 z-40 cursor-default bg-text-primary/20 backdrop-blur-sm lg:hidden"
        />
      ) : null}

      <nav
        aria-label="Primary"
        data-collapsed={isCollapsed ? "true" : undefined}
        className={cn(
          // Base: a subtly-tinted panel column (bg-panel ≈ #fafafa, dark-mode
          // safe), divided from the white content area by a hairline right edge.
          // On lg+ it is a static flex sibling; below lg an off-canvas drawer.
          "flex shrink-0 flex-col border-r border-border bg-panel",
          "fixed inset-y-0 left-0 z-50 w-60 max-w-[80vw] transition-transform duration-200",
          drawerOpen ? "translate-x-0" : "-translate-x-full",
          // lg+: in-flow, no transform, width toggles between expanded/collapsed.
          "lg:static lg:z-auto lg:max-w-none lg:translate-x-0 lg:transition-[width] lg:duration-200",
          isCollapsed ? "lg:w-14" : "lg:w-60",
        )}
      >
        {mode === "nav" ? (
          <NavMode
            collapsed={isCollapsed}
            mounted={mounted}
            currentProjectId={currentProjectId}
            pathname={pathname}
            onToggleCollapse={toggle}
            onOpenInbox={() => setMode("inbox")}
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

/** The slim mobile-only top strip: brand mark + a hamburger that opens the drawer. */
function MobileStrip({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="sticky top-0 z-30 flex h-[46px] items-center gap-2 border-b border-border bg-bg/85 px-3 backdrop-blur lg:hidden">
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
        <span className="text-label-sm text-text-secondary">Creative Review</span>
      </span>
    </div>
  );
}

interface NavModeProps {
  collapsed: boolean;
  mounted: boolean;
  currentProjectId: string;
  pathname: string;
  onToggleCollapse: () => void;
  onOpenInbox: () => void;
  onOpenAccount: () => void;
  onNavigate: () => void;
}

function NavMode({
  collapsed,
  mounted,
  currentProjectId,
  pathname,
  onToggleCollapse,
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
      {/* Brand + collapse toggle. */}
      <div className="flex h-[46px] items-center gap-2 border-b border-border px-2.5">
        <Link
          href={homeHref}
          onClick={onNavigate}
          aria-label="Creative Review home"
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
            Creative Review
          </span>
        ) : null}
        {/* The collapse toggle only makes sense at lg+ where the width is fixed;
            in the mobile drawer the full label width is always shown. Until
            mounted we render the expand icon as a stable placeholder. */}
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          title={collapsed ? "Expand navigation" : "Collapse navigation"}
          className={cn(
            "hidden size-7 shrink-0 items-center justify-center rounded-control lg:inline-flex",
            "text-text-tertiary transition-colors hover:bg-panel hover:text-text-primary",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
            collapsed ? "mx-auto" : "",
          )}
        >
          {mounted && collapsed ? (
            <PanelLeftOpen className="size-4" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="size-4" aria-hidden="true" />
          )}
        </button>
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
        <ThemeToggle asMenuItem className={railRowClass(false, collapsed)} />
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
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      className={railRowClass(active, collapsed)}
    >
      <span className="shrink-0">{icon}</span>
      {!collapsed ? <span className="min-w-0 flex-1 truncate">{label}</span> : null}
    </Link>
  );
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
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? label : undefined}
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
