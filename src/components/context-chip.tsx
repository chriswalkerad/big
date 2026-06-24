import { cn } from "@/lib/utils";

interface ContextChipProps {
  /** Project name, e.g. "Eloise at The Plaza". */
  name: string;
  /** Short audience descriptor, e.g. "Kids 6-12". */
  audience: string;
  className?: string;
}

/** Read-only project-context pill: "Name · Audience". */
export function ContextChip({ name, audience, className }: ContextChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill bg-panel px-2.5 py-1 text-label-sm text-text-secondary",
        className,
      )}
    >
      <span className="text-text-primary">{name}</span>
      <span aria-hidden="true" className="text-text-tertiary">
        ·
      </span>
      <span>{audience}</span>
    </span>
  );
}
