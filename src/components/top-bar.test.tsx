import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "./theme-provider";
import { TopBar } from "./top-bar";

// TopBar renders ThemeToggle (inside the overflow menu), which reads
// window.matchMedia via next-themes; jsdom omits it, so stub a deterministic
// (light) preference.
beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.className = "";
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
});

function renderTopBar(props: Parameters<typeof TopBar>[0] = {}) {
  return render(
    <ThemeProvider>
      <TopBar {...props} />
    </ThemeProvider>,
  );
}

describe("TopBar", () => {
  it("renders a banner with the brand home link", () => {
    renderTopBar();
    expect(screen.getByRole("banner")).toBeInTheDocument();
    const home = screen.getByRole("link", { name: /creative review home/i });
    expect(home).toHaveAttribute("href", "/");
  });

  it("renders the breadcrumb and actions slots", () => {
    renderTopBar({
      breadcrumb: <nav aria-label="Breadcrumb">trail</nav>,
      actions: <button type="button">Run review</button>,
    });
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run review" })).toBeInTheDocument();
  });

  it("hides the overflow menu contents until opened", () => {
    renderTopBar();
    expect(screen.queryByRole("link", { name: /settings/i })).toBeNull();
  });

  it("opens the overflow menu with Settings and the theme toggle", async () => {
    const user = userEvent.setup();
    renderTopBar();

    await user.click(screen.getByRole("button", { name: /more options/i }));

    const settings = screen.getByRole("menuitem", { name: /settings/i });
    expect(settings).toHaveAttribute("href", "/settings/signals");
    // Theme is now a sibling "<icon> Theme" menuitem (same style as Settings).
    expect(
      await screen.findByRole("menuitem", { name: /switch to (light|dark) theme/i }),
    ).toBeInTheDocument();
  });
});
