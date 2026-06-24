import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "./theme-provider";
import { AppShell } from "./app-shell";

// AppShell renders ThemeToggle, which reads window.matchMedia via next-themes;
// jsdom omits it, so stub a deterministic (light) preference.
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

function renderShell() {
  return render(
    <ThemeProvider>
      <AppShell>
        <p>Page content</p>
      </AppShell>
    </ThemeProvider>,
  );
}

describe("AppShell", () => {
  it("renders the Settings link pointing at the signal admin", () => {
    renderShell();
    const link = screen.getByRole("link", { name: /settings/i });
    expect(link).toHaveAttribute("href", "/settings/signals");
  });

  it("renders the theme toggle", async () => {
    renderShell();
    expect(
      await screen.findByRole("button", { name: /switch to (light|dark) theme/i }),
    ).toBeInTheDocument();
  });

  it("renders its children inside the content container", () => {
    renderShell();
    expect(screen.getByText("Page content")).toBeInTheDocument();
  });
});
