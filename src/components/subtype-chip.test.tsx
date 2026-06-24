import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SubtypeChip, SUBTYPE_LABELS, SUBTYPE_ORDER } from "./subtype-chip";

describe("SubtypeChip", () => {
  it.each(SUBTYPE_ORDER)("renders the label for %s", (subtype) => {
    render(<SubtypeChip subtype={subtype} />);
    expect(screen.getByText(SUBTYPE_LABELS[subtype])).toBeInTheDocument();
  });
});
