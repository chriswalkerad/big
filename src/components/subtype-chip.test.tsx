import { describe, it, expect } from "vitest";
import { SUBTYPE_LABELS, SUBTYPE_ORDER } from "./subtype-chip";

describe("subtype labels", () => {
  it.each(SUBTYPE_ORDER)("has a non-empty label for %s", (subtype) => {
    expect(SUBTYPE_LABELS[subtype]).toBeTruthy();
  });

  it("orders every labelled subtype exactly once", () => {
    expect([...SUBTYPE_ORDER].sort()).toEqual(
      Object.keys(SUBTYPE_LABELS).sort(),
    );
  });
});
