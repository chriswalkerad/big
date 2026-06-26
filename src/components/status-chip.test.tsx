import { describe, it, expect } from "vitest";
import { STATUS_LABELS, STATUS_ORDER } from "./status-chip";

describe("status labels", () => {
  it.each(STATUS_ORDER)("has a non-empty label for %s", (status) => {
    expect(STATUS_LABELS[status]).toBeTruthy();
  });

  it("orders every labelled status exactly once", () => {
    expect([...STATUS_ORDER].sort()).toEqual(
      Object.keys(STATUS_LABELS).sort(),
    );
  });
});
