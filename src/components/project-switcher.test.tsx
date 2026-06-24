import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectSwitcher } from "./project-switcher";

// ProjectSwitcher reads the project list through StorageRepository, which seeds the
// two demo projects (Eloise, Speed) on first run into a fresh localStorage. Start
// each test clean so the seed runs deterministically.
beforeEach(() => {
  window.localStorage.clear();
});

describe("ProjectSwitcher", () => {
  it("renders the current project's name as the trigger with a popup", async () => {
    render(<ProjectSwitcher currentProjectId="proj-eloise" />);
    const trigger = await screen.findByRole("button", { name: "Switch project" });
    expect(trigger).toHaveTextContent("Eloise at The Plaza");
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("lists every seeded project linking to its library when opened", async () => {
    const user = userEvent.setup();
    render(<ProjectSwitcher currentProjectId="proj-eloise" />);

    await user.click(await screen.findByRole("button", { name: "Switch project" }));

    const menu = screen.getByRole("menu");
    const eloise = within(menu).getByRole("menuitem", { name: /Eloise at The Plaza/ });
    const speed = within(menu).getByRole("menuitem", { name: /Speed — The Anime/ });

    expect(eloise).toHaveAttribute("href", "/p/proj-eloise");
    expect(speed).toHaveAttribute("href", "/p/proj-speed-anime");
  });

  it("marks and disables the current project, leaving others active", async () => {
    const user = userEvent.setup();
    render(<ProjectSwitcher currentProjectId="proj-eloise" />);

    await user.click(await screen.findByRole("button", { name: "Switch project" }));
    const menu = screen.getByRole("menu");

    const eloise = within(menu).getByRole("menuitem", { name: /Eloise at The Plaza/ });
    expect(eloise).toHaveAttribute("aria-current", "page");
    expect(eloise).toHaveAttribute("aria-disabled", "true");

    const speed = within(menu).getByRole("menuitem", { name: /Speed — The Anime/ });
    expect(speed).not.toHaveAttribute("aria-current");
    expect(speed).not.toHaveAttribute("aria-disabled");
  });

  it("closes the menu on Escape", async () => {
    const user = userEvent.setup();
    render(<ProjectSwitcher currentProjectId="proj-eloise" />);

    await user.click(await screen.findByRole("button", { name: "Switch project" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
