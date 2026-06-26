import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

/** Centered empty state. Uses the display type scale (reserved for empty states). */
export function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-16 text-center",
        className,
      )}
    >
      {/* Decorative illustration only; the title/description carry the meaning. */}
      {icon ? <div aria-hidden="true" className="text-text-tertiary">{icon}</div> : null}
      <h2 className="text-display text-text-primary">{title}</h2>
      {description ? (
        <p className="max-w-prose text-body text-text-secondary">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
