import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge, type BadgeVariant } from "./badge";

const VARIANTS: BadgeVariant[] = ["status", "subtype", "context", "mode"];

/** The shared base pill classes every variant must carry. */
const BASE_CLASSES = [
  "inline-flex",
  "items-center",
  "gap-1",
  "rounded-pill",
  "border",
  "border-border",
  "px-2",
  "py-0.5",
  "text-label-xs",
];

describe("Badge", () => {
  it.each(VARIANTS)("renders its children with the shared base pill for %s", (variant) => {
    render(<Badge variant={variant}>Label</Badge>);
    const pill = screen.getByText("Label");
    for (const cls of BASE_CLASSES) {
      expect(pill).toHaveClass(cls);
    }
  });

  it("defaults to the status variant", () => {
    render(<Badge>Default</Badge>);
    const pill = screen.getByText("Default");
    expect(pill).toHaveClass("bg-panel", "text-text-secondary");
  });

  it("toggles the leading dot indicator", () => {
    const { rerender, container } = render(<Badge variant="status">No dot</Badge>);
    expect(container.querySelector("[data-badge-dot]")).toBeNull();

    rerender(
      <Badge variant="status" dot>
        With dot
      </Badge>,
    );
    expect(container.querySelector("[data-badge-dot]")).not.toBeNull();
  });

  it("renders subtype and mode uppercase", () => {
    const { rerender } = render(<Badge variant="subtype">subtype</Badge>);
    expect(screen.getByText("subtype")).toHaveClass("uppercase");

    rerender(<Badge variant="mode">mode</Badge>);
    expect(screen.getByText("mode")).toHaveClass("uppercase");
  });

  it("merges a custom className", () => {
    render(
      <Badge variant="context" className="custom-class">
        ctx
      </Badge>,
    );
    expect(screen.getByText("ctx")).toHaveClass("custom-class");
  });
});
