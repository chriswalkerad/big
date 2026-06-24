import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ContextChip } from "./context-chip";

describe("ContextChip", () => {
  it("renders the project name and audience", () => {
    render(<ContextChip name="Eloise at The Plaza" audience="Kids 6-12" />);
    expect(screen.getByText("Eloise at The Plaza")).toBeInTheDocument();
    expect(screen.getByText("Kids 6-12")).toBeInTheDocument();
  });
});
