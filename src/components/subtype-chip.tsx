import type { TextSubtype } from "@/types";

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
