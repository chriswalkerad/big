import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppShell } from "./app-shell";

// AppShell is now a route-agnostic frame: the outer page surface plus a
// centered <main>. The header (Settings link + theme toggle) moved to the
// per-page <TopBar>, so the shell itself renders no chrome.

describe("AppShell", () => {
  it("renders its children inside the main content container", () => {
    render(
      <AppShell>
        <p>Page content</p>
      </AppShell>,
    );
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main-content");
    expect(main).toContainElement(screen.getByText("Page content"));
  });

  it("owns no header chrome (no Settings link, no theme toggle)", () => {
    render(
      <AppShell>
        <p>Page content</p>
      </AppShell>,
    );
    expect(screen.queryByRole("link", { name: /settings/i })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /switch to (light|dark) theme/i }),
    ).toBeNull();
    expect(screen.queryByRole("banner")).toBeNull();
  });

  it("applies a className override to the main container", () => {
    render(
      <AppShell className="max-w-7xl">
        <p>Wide</p>
      </AppShell>,
    );
    expect(screen.getByRole("main").className).toContain("max-w-7xl");
  });
});
