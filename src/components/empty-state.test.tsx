import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("renders the title, description, and action", () => {
    render(
      <EmptyState
        title="No matches"
        description="Nothing matched your search."
        action={<button type="button">Clear</button>}
      />,
    );
    expect(screen.getByRole("heading", { name: "No matches" })).toBeInTheDocument();
    expect(screen.getByText("Nothing matched your search.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
  });

  it("omits description and action when not provided", () => {
    render(<EmptyState title="Empty" />);
    expect(screen.getByRole("heading", { name: "Empty" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
