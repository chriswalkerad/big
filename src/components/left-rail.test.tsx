import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "./theme-provider";
import { LeftRail, RailEdgeToggle } from "./left-rail";

// LeftRail reads the route via next/navigation; mock both hooks per test.
const pathnameMock = vi.fn(() => "/p/proj-eloise");
const paramsMock = vi.fn<() => { projectId?: string }>(() => ({
  projectId: "proj-eloise",
}));
vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock(),
  useParams: () => paramsMock(),
}));

const RAIL_KEY = "bsp:ui:rail-collapsed";
const LAST_PROJECT_KEY = "bsp:ui:last-project";

beforeEach(() => {
  window.localStorage.clear();
  pathnameMock.mockReturnValue("/p/proj-eloise");
  paramsMock.mockReturnValue({ projectId: "proj-eloise" });
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

function renderRail() {
  return render(
    <ThemeProvider>
      <LeftRail />
      {/* The collapse toggle lives OUTSIDE the rail now (AppShell renders it as a
          floating edge control); include it so its behavior can be exercised. */}
      <RailEdgeToggle />
    </ThemeProvider>,
  );
}

describe("LeftRail", () => {
  it("renders the primary nav items (Home, Projects, Inbox, Settings, Account)", () => {
    renderRail();
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(nav).getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/p/proj-eloise",
    );
    // The seeded projects appear as links.
    expect(
      within(nav).getByRole("link", { name: /Eloise at The Plaza/ }),
    ).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: /Inbox/ })).toBeInTheDocument();
    // Compose links to the new-document route.
    expect(within(nav).getByRole("link", { name: "Compose" })).toHaveAttribute(
      "href",
      "/p/proj-eloise/d/new",
    );
    expect(within(nav).getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/settings/signals",
    );
    expect(
      within(nav).getByRole("button", { name: "Account" }),
    ).toBeInTheDocument();
  });

  it("returns null on an editor path", () => {
    pathnameMock.mockReturnValue("/p/proj-eloise/d/doc-1/review");
    const { container } = renderRail();
    expect(
      screen.queryByRole("navigation", { name: "Primary" }),
    ).toBeNull();
    // Nothing but the (empty) dialog portal slot — no rail chrome.
    expect(container.querySelector("nav")).toBeNull();
  });

  it("switches into inbox mode on Inbox click, and back via the back button", async () => {
    const user = userEvent.setup();
    renderRail();
    const nav = screen.getByRole("navigation", { name: "Primary" });

    await user.click(within(nav).getByRole("button", { name: /Inbox/ }));

    // Inbox mode shows a Back control; Home is gone.
    const back = await within(nav).findByRole("button", {
      name: "Back to navigation",
    });
    expect(back).toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Home" })).toBeNull();

    await user.click(back);

    // Back in nav mode: Home returns.
    expect(
      within(nav).getByRole("link", { name: "Home" }),
    ).toBeInTheDocument();
  });

  it("expands the rail when Inbox is clicked while collapsed", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(RAIL_KEY, "true");
    renderRail();
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(nav).toHaveAttribute("data-collapsed", "true");

    await user.click(within(nav).getByRole("button", { name: /Inbox/ }));

    // The rail expands so the inbox rows are readable, and the expanded width
    // is persisted; the inbox view (Back control) is now shown.
    expect(nav).not.toHaveAttribute("data-collapsed");
    expect(window.localStorage.getItem(RAIL_KEY)).toBe("false");
    expect(
      await within(nav).findByRole("button", { name: "Back to navigation" }),
    ).toBeInTheDocument();
  });

  it("returns to nav mode when the rail is collapsed while in inbox", async () => {
    const user = userEvent.setup();
    renderRail();
    const nav = screen.getByRole("navigation", { name: "Primary" });

    // Open the inbox.
    await user.click(within(nav).getByRole("button", { name: /Inbox/ }));
    expect(
      await within(nav).findByRole("button", { name: "Back to navigation" }),
    ).toBeInTheDocument();

    // Collapsing drops back to nav mode: Home returns, the inbox Back is gone.
    await user.click(screen.getByRole("button", { name: "Collapse navigation" }));
    expect(
      within(nav).queryByRole("button", { name: "Back to navigation" }),
    ).toBeNull();
    expect(within(nav).getByRole("link", { name: "Home" })).toBeInTheDocument();
  });

  it("the external edge toggle flips collapsed state and persists to localStorage", async () => {
    const user = userEvent.setup();
    renderRail();

    // The collapse toggle is the floating edge control rendered OUTSIDE the rail
    // (by AppShell), so it is queried at the document level, not within the nav.
    const collapse = screen.getByRole("button", { name: "Collapse navigation" });
    await user.click(collapse);

    expect(window.localStorage.getItem(RAIL_KEY)).toBe("true");
    // Now collapsed: the toggle's label flips to "Expand navigation".
    const expand = screen.getByRole("button", { name: "Expand navigation" });
    await user.click(expand);
    expect(window.localStorage.getItem(RAIL_KEY)).toBe("false");
  });

  it("the edge toggle returns null on editor routes (no rail there)", () => {
    pathnameMock.mockReturnValue("/p/proj-eloise/d/doc-1/review");
    renderRail();
    expect(
      screen.queryByRole("button", { name: /navigation$/ }),
    ).toBeNull();
  });

  it("persists the project id when visiting a /p/{id} route", () => {
    pathnameMock.mockReturnValue("/p/proj-speed-anime");
    paramsMock.mockReturnValue({ projectId: "proj-speed-anime" });
    renderRail();
    expect(window.localStorage.getItem(LAST_PROJECT_KEY)).toBe(
      "proj-speed-anime",
    );
  });

  it("resolves to the persisted project (not the seeded fallback) on /settings", () => {
    // Pretend the user was last inside a non-seeded-default project.
    window.localStorage.setItem(LAST_PROJECT_KEY, "proj-speed-anime");
    // A settings route has no project id in the path or params.
    pathnameMock.mockReturnValue("/settings/signals");
    paramsMock.mockReturnValue({});
    renderRail();
    const nav = screen.getByRole("navigation", { name: "Primary" });
    // Home points at the persisted project, NOT the seeded proj-eloise.
    expect(within(nav).getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/p/proj-speed-anime",
    );
  });

  it("reads a persisted collapsed value from localStorage on mount", () => {
    window.localStorage.setItem(RAIL_KEY, "true");
    renderRail();
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(nav).toHaveAttribute("data-collapsed", "true");
    // Collapsed: labels are dropped, so Home is reachable by its aria-label only.
    expect(within(nav).getByRole("link", { name: "Home" })).toBeInTheDocument();
  });
});
