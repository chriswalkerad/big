import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Breadcrumb, type BreadcrumbSegment } from "./breadcrumb";

describe("Breadcrumb", () => {
  it("renders all segments in order", () => {
    const segments: BreadcrumbSegment[] = [
      { label: "Account" },
      { label: "Eloise at The Plaza" },
      { label: "Midnight Caper", current: true },
    ];
    render(<Breadcrumb segments={segments} />);

    expect(screen.getByText("Account")).toBeInTheDocument();
    expect(screen.getByText("Eloise at The Plaza")).toBeInTheDocument();
    expect(screen.getByText("Midnight Caper")).toBeInTheDocument();
  });

  it("exposes an accessible navigation landmark", () => {
    render(<Breadcrumb segments={[{ label: "Home", current: true }]} />);
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
  });

  it("marks the current segment with aria-current=page", () => {
    render(
      <Breadcrumb
        segments={[
          { label: "Root", href: "/" },
          { label: "Active", current: true },
        ]}
      />,
    );
    const active = screen.getByText("Active");
    expect(active).toHaveAttribute("aria-current", "page");

    // Non-current segments do not carry aria-current.
    expect(screen.getByText("Root")).not.toHaveAttribute("aria-current");
  });

  it("renders an href segment as a link with the correct destination", () => {
    render(
      <Breadcrumb segments={[{ label: "Library", href: "/p/proj-eloise" }]} />,
    );
    const link = screen.getByRole("link", { name: "Library" });
    expect(link).toHaveAttribute("href", "/p/proj-eloise");
  });

  it("renders an onClick segment as a button and fires its handler", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Breadcrumb segments={[{ label: "Account", onClick }]} />);

    const button = screen.getByRole("button", { name: "Account" });
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders a plain segment (no href/onClick) as static text, not a control", () => {
    render(<Breadcrumb segments={[{ label: "Plain" }]} />);
    expect(screen.queryByRole("link", { name: "Plain" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Plain" })).not.toBeInTheDocument();
    expect(screen.getByText("Plain")).toBeInTheDocument();
  });
});
