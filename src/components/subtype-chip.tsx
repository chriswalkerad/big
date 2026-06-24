import type { TextSubtype } from "@/types";
import { cn } from "@/lib/utils";

/** Human-readable labels for each text subtype (also used by the subtype dropdown). */
export const SUBTYPE_LABELS: Record<TextSubtype, string> = {
  story_premise: "Story Premise",
  character_concept: "Character Concept",
  world_building: "World Building",
  script_excerpt: "Script Excerpt",
  creative_brief: "Creative Brief",
};

export const SUBTYPE_ORDER: TextSubtype[] = [
  "story_premise",
  "character_concept",
  "world_building",
  "script_excerpt",
  "creative_brief",
];

interface SubtypeChipProps {
  subtype: TextSubtype;
  className?: string;
}

/** Neutral, uppercase subtype tag. */
export function SubtypeChip({ subtype, className }: SubtypeChipProps) {
  return (
    <span
      data-subtype={subtype}
      className={cn(
        "inline-flex items-center rounded-pill border border-border bg-surface px-2 py-0.5 text-label-xs uppercase text-text-tertiary",
        className,
      )}
    >
      {SUBTYPE_LABELS[subtype]}
    </span>
  );
}
