import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LoadingState } from "./loading-state";

describe("LoadingState", () => {
  it("exposes an accessible busy status with its label", () => {
    render(<LoadingState rows={4} label="Loading documents" />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Loading documents")).toBeInTheDocument();
  });
});
