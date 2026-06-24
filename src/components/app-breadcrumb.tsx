"use client";

import { useState } from "react";
import { Breadcrumb, type BreadcrumbSegment } from "@/components/breadcrumb";
import { AccountDialog } from "@/components/account-dialog";

export interface AppBreadcrumbProps {
  /**
   * The project/document portion of the trail (everything after "Account").
   * Mark the active segment with `current: true`. The Account segment is
   * prepended automatically and wired to the project-switcher stub popup.
   */
  segments: BreadcrumbSegment[];
  /** Label for the leading account segment. Defaults to "Account". */
  accountLabel?: string;
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
  className,
}: AppBreadcrumbProps) {
  const [accountOpen, setAccountOpen] = useState(false);

  const accountSegment: BreadcrumbSegment = {
    label: accountLabel,
    onClick: () => setAccountOpen(true),
  };

  return (
    <>
      <Breadcrumb segments={[accountSegment, ...segments]} className={className} />
      <AccountDialog open={accountOpen} onClose={() => setAccountOpen(false)} />
    </>
  );
}
