import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SignalsAdminPage from "./page";
import { StorageRepository } from "@/lib/storage";
import { seedSignals } from "@/lib/seed-data";

// The page calls createStorageRepository(), which uses window.localStorage in
// jsdom. We assert against the SAME store via a separate StorageRepository —
// i.e. exactly the set the review reads at submit time.

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

/** A repository reading the same localStorage the page wrote to. */
function storeReader(): StorageRepository {
  return new StorageRepository({ seed: false });
}

describe("SignalsAdminPage", () => {
  it("renders the plain in-column page header (no global-nav chrome)", async () => {
    render(<SignalsAdminPage />);
    // The slim header keeps the page <h1> and the + New Signal action; the
    // persistent left-rail now owns all global nav, so the page
    // no longer renders a TopBar or breadcrumb.
    expect(
      screen.getByRole("heading", { level: 1, name: "Signals" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "New Signal" }),
    ).toBeInTheDocument();
    // The TopBar's global-nav brand link is gone (the rail owns it now).
    expect(
      screen.queryByRole("link", { name: "Creative Review home" }),
    ).not.toBeInTheDocument();
  });

  it("sets a page-specific document title (WCAG 2.4.2)", async () => {
    render(<SignalsAdminPage />);
    await waitFor(() =>
      expect(document.title).toBe("Signals — Settings — Big Review"),
    );
  });

  it("shows the six seeded signals on first load", async () => {
    render(<SignalsAdminPage />);
    const list = await screen.findByRole("list", { name: "Signals" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(seedSignals.length);
    for (const signal of seedSignals) {
      expect(within(list).getByText(signal.name)).toBeInTheDocument();
    }
  });

  it("creates a new signal and writes it through StorageRepository", async () => {
    const user = userEvent.setup();
    render(<SignalsAdminPage />);
    await screen.findByRole("list", { name: "Signals" });

    await user.click(screen.getByRole("button", { name: "New Signal" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Name"), "Originality");
    await user.type(within(dialog).getByLabelText("Prompt"), "Judge how fresh it is.");
    await user.clear(within(dialog).getByLabelText(/Threshold/));
    await user.type(within(dialog).getByLabelText(/Threshold/), "80");
    await user.click(within(dialog).getByRole("button", { name: "Create signal" }));

    await waitFor(() => {
      const saved = storeReader()
        .listSignals()
        .find((s) => s.name === "Originality");
      expect(saved).toBeDefined();
      expect(saved?.threshold).toBe(80);
      expect(saved?.id).toBe("originality");
    });
    // And it appears in the list.
    expect(await screen.findByText("Originality")).toBeInTheDocument();
  });

  it("edits an existing signal and updates it in StorageRepository", async () => {
    const user = userEvent.setup();
    render(<SignalsAdminPage />);
    await screen.findByRole("list", { name: "Signals" });

    await user.click(screen.getByRole("button", { name: "Edit Clarity" }));
    const dialog = screen.getByRole("dialog");
    const nameInput = within(dialog).getByLabelText("Name");
    await user.clear(nameInput);
    await user.type(nameInput, "Clarity & Flow");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      // Same id (edit preserves it), updated name.
      const updated = storeReader().getSignal("clarity");
      expect(updated?.name).toBe("Clarity & Flow");
    });
    // No duplicate record was created.
    expect(storeReader().listSignals()).toHaveLength(seedSignals.length);
  });

  it("deletes a signal after confirmation and removes it from list()", async () => {
    const user = userEvent.setup();
    render(<SignalsAdminPage />);
    await screen.findByRole("list", { name: "Signals" });

    expect(storeReader().getSignal("hook_strength")).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Delete Hook Strength" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      // Absent from the set the review would read.
      const ids = storeReader()
        .listSignals()
        .map((s) => s.id);
      expect(ids).not.toContain("hook_strength");
      expect(ids).toHaveLength(seedSignals.length - 1);
    });
    expect(screen.queryByText("Hook Strength")).not.toBeInTheDocument();
  });

  it("does not delete when the confirmation is cancelled", async () => {
    const user = userEvent.setup();
    render(<SignalsAdminPage />);
    await screen.findByRole("list", { name: "Signals" });

    await user.click(screen.getByRole("button", { name: "Delete Clarity" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(storeReader().getSignal("clarity")).not.toBeNull();
  });
});
