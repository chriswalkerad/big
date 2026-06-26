import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ThemeProvider } from "./theme-provider";
import { AppShell } from "./app-shell";

// AppShell is a flex row of the collapsible LeftRail + a centered <main>. The
// rail is a client component that reads the route via next/navigation, so the
// path is mocked per test. On editor routes the rail returns null, leaving a
// bare centered <main>.
const pathnameMock = vi.fn(() => "/p/proj-eloise");
vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock(),
  useParams: () => ({}),
}));

// next-themes needs matchMedia; jsdom lacks it.
beforeEach(() => {
  window.localStorage.clear();
  pathnameMock.mockReturnValue("/p/proj-eloise");
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

function renderShell(children: React.ReactNode, className?: string) {
  return render(
    <ThemeProvider>
      <AppShell className={className}>{children}</AppShell>
    </ThemeProvider>,
  );
}

describe("AppShell", () => {
  it("renders its children inside the main content container", () => {
    renderShell(<p>Page content</p>);
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main-content");
    expect(main).toContainElement(screen.getByText("Page content"));
  });

  it("renders the LeftRail on a library path", () => {
    renderShell(<p>Page content</p>);
    expect(
      screen.getByRole("navigation", { name: "Primary" }),
    ).toBeInTheDocument();
  });

  it("does NOT render the LeftRail on an editor path", () => {
    pathnameMock.mockReturnValue("/p/proj-eloise/d/doc-1/review");
    renderShell(<p>Page content</p>);
    expect(screen.queryByRole("navigation", { name: "Primary" })).toBeNull();
    // The centered <main> still holds the page content.
    expect(screen.getByRole("main")).toContainElement(
      screen.getByText("Page content"),
    );
  });

  it("owns no <banner> header chrome — the rail is a <nav>, not a header", () => {
    renderShell(<p>Page content</p>);
    expect(screen.queryByRole("banner")).toBeNull();
  });

  it("applies a className override to the main container", () => {
    renderShell(<p>Wide</p>, "max-w-7xl");
    expect(screen.getByRole("main").className).toContain("max-w-7xl");
  });

  it("highlights the current project link inside the rail", () => {
    renderShell(<p>Page content</p>);
    const nav = screen.getByRole("navigation", { name: "Primary" });
    // Home + the current project link carry aria-current="page".
    const current = within(nav).getAllByRole("link", { current: "page" });
    expect(current.length).toBeGreaterThan(0);
  });
});
