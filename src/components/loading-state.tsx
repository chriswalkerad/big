import { cn } from "@/lib/utils";

interface LoadingStateProps {
  /** Number of skeleton rows to render. */
  rows?: number;
  className?: string;
  label?: string;
}

/** Parameterized skeleton placeholder with an accessible busy status. */
export function LoadingState({ rows = 3, className, label = "Loading…" }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={cn("flex w-full flex-col gap-3", className)}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={`skeleton-row-${i}`}
          className="skeleton h-4 rounded-control"
          style={{ width: `${90 - i * 12}%` }}
        />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}
