"use client";

import { useState } from "react";
import { Breadcrumb, type BreadcrumbSegment } from "@/components/breadcrumb";
import { AccountDialog } from "@/components/account-dialog";
import { ProjectSwitcher } from "@/components/project-switcher";

export interface AppBreadcrumbProps {
  /**
   * The project/document portion of the trail (everything after "Account").
   * Mark the active segment with `current: true`. The Account segment is
   * prepended automatically and wired to the project-switcher stub popup.
   */
  segments: BreadcrumbSegment[];
  /** Label for the leading account segment. Defaults to "Account". */
  accountLabel?: string;
  /**
   * When set, the project segment (the first of `segments`) renders as the
   * interactive `ProjectSwitcher` dropdown instead of plain text, letting the
   * user jump between projects. The Account segment and any later segments are
   * unchanged.
   */
  currentProjectId?: string;
  className?: string;
}

/**
 * Account-aware breadcrumb. Prepends a wired "Account" segment to the supplied
 * project/document `segments` and owns the Account stub popup, so a page can
 * render its full breadcrumb (Account > Project > Document) in a single
 * component:
 *
 * ```tsx
 * <AppBreadcrumb
 *   segments={[
 *     { label: "Eloise at The Plaza", href: "/p/proj-eloise" },
 *     { label: doc.title, current: true },
 *   ]}
 * />
 * ```
 *
 * The "Account" segment renders as a button; activating it opens the popup
 * (see `AccountDialog`). For a breadcrumb without the Account stub, use the
 * presentational `Breadcrumb` directly.
 */
export function AppBreadcrumb({
  segments,
  accountLabel = "Account",
  currentProjectId,
  className,
}: AppBreadcrumbProps) {
  const [accountOpen, setAccountOpen] = useState(false);

  const accountSegment: BreadcrumbSegment = {
    label: accountLabel,
    onClick: () => setAccountOpen(true),
  };

  // When a project id is supplied, swap the project (first) segment's content for
  // the interactive switcher, keeping its label/current flag for keying + a11y.
  const projectSegments =
    currentProjectId && segments.length > 0
      ? [
          {
            ...segments[0],
            content: <ProjectSwitcher currentProjectId={currentProjectId} />,
          },
          ...segments.slice(1),
        ]
      : segments;

  return (
    <>
      <Breadcrumb
        segments={[accountSegment, ...projectSegments]}
        className={className}
      />
      <AccountDialog open={accountOpen} onClose={() => setAccountOpen(false)} />
    </>
  );
}
