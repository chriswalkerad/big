import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "./theme-provider";
import { ThemeToggle } from "./theme-toggle";

// next-themes reads window.matchMedia to resolve the system theme; jsdom does
// not implement it, so stub it to a deterministic (light) preference.
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

function renderToggle() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  );
}

describe("ThemeToggle", () => {
  it("renders an accessible toggle once mounted", async () => {
    renderToggle();
    const button = await screen.findByRole("button", {
      name: /switch to (light|dark) theme/i,
    });
    expect(button).toBeInTheDocument();
  });

  it("toggles to dark mode and persists the choice on click", async () => {
    const user = userEvent.setup();
    renderToggle();

    // System preference resolves to light, so the first action is "go dark".
    const toDark = await screen.findByRole("button", {
      name: /switch to dark theme/i,
    });
    await user.click(toDark);

    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
    expect(window.localStorage.getItem("theme")).toBe("dark");

    // The label flips, and clicking again returns to light.
    const toLight = await screen.findByRole("button", {
      name: /switch to light theme/i,
    });
    await user.click(toLight);

    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });
    expect(window.localStorage.getItem("theme")).toBe("light");
  });
});
