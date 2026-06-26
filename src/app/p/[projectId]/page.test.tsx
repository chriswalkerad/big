import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { LibraryView } from "./page";

// The library page reads through StorageRepository, which seeds the four demo
// documents on first run into a fresh localStorage. Start each test clean so the
// seed runs deterministically.
beforeEach(() => {
  window.localStorage.clear();
});

// LibraryView takes the unwrapped projectId directly (the route default export
// handles unwrapping the Next 16 `params` Promise with `use()`), so tests render
// it without a Suspense boundary.
function renderLibrary(projectId = "proj-eloise") {
  return render(<LibraryView projectId={projectId} />);
}

describe("LibraryPage", () => {
  it("renders the seeded documents as rows linking to the doc page", async () => {
    renderLibrary();

    const caper = await screen.findByText("Eloise and the Midnight Room-Service Caper");
    expect(caper).toBeInTheDocument();
    expect(screen.getByText("A New Friend at the Plaza")).toBeInTheDocument();
    expect(screen.getByText("Eloise and the Haunted Service Elevator")).toBeInTheDocument();
    expect(screen.getByText("Rooftop idea")).toBeInTheDocument();

    const caperLink = caper.closest("a");
    expect(caperLink).toHaveAttribute("href", "/p/proj-eloise/d/doc-midnight-caper");
  });

  it("shows the project owner on every row and the reviewer (— for drafts)", async () => {
    renderLibrary();
    await screen.findByText("Eloise and the Midnight Room-Service Caper");

    // Eloise's owner is Maya Kambe (seed); it appears on every row.
    const owners = screen.getAllByText(/Owner: Maya Kambe/);
    expect(owners.length).toBeGreaterThan(0);

    // A submitted doc shows its reviewer's name; the "Rooftop idea" draft shows "—".
    expect(screen.getAllByText(/Reviewer: /).length).toBeGreaterThan(0);
    const draftRow = screen.getByText("Rooftop idea").closest("a");
    expect(draftRow).not.toBeNull();
    expect(draftRow).toHaveTextContent(/Reviewer: —/);
  });

  it("no longer renders a New/Compose button in the page header (it moved to the left rail)", async () => {
    renderLibrary();
    await screen.findByText("Eloise and the Midnight Room-Service Caper");
    // Composing a new document now lives in the persistent left rail's "Compose"
    // item, so the library header carries no New/Compose action.
    expect(screen.queryByRole("link", { name: /new document/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /compose/i })).toBeNull();
  });

  it("renders subtype and status as plain single-line text, not pills/badges", async () => {
    renderLibrary();
    const caper = await screen.findByText("Eloise and the Midnight Room-Service Caper");
    const row = caper.closest("a");
    expect(row).not.toBeNull();
    // The ≥sm status cell is plain text styled with text-label-sm/secondary and
    // forced onto one line (whitespace-nowrap), no rounded pill.
    const status = within(row as HTMLElement).getAllByText("Approved")[0];
    expect(status.className).toContain("whitespace-nowrap");
    expect(status.className).not.toContain("rounded-pill");
  });

  it("renders the project name as a plain page title", async () => {
    renderLibrary();
    const title = await screen.findByRole("heading", {
      level: 1,
      name: "Eloise at The Plaza",
    });
    expect(title).toBeInTheDocument();
    // The title is plain text now (global nav / project switching lives in the
    // left rail), so it carries no interactive switcher trigger.
    expect(title.querySelector("button")).toBeNull();
  });

  it("uses the new search placeholder copy", async () => {
    renderLibrary();
    const search = await screen.findByRole("searchbox", { name: /search documents/i });
    expect(search).toHaveAttribute("placeholder", "Find anything in this project…");
  });

  it("filters by a full-text query over body and shows an empty state for no match", async () => {
    renderLibrary();
    const search = await screen.findByRole("searchbox", { name: /search documents/i });

    // "bellhop" only appears in the haunted-elevator body.
    fireEvent.change(search, { target: { value: "bellhop" } });
    expect(
      screen.getByText("Eloise and the Haunted Service Elevator"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Eloise and the Midnight Room-Service Caper"),
    ).not.toBeInTheDocument();

    // A query that matches nothing shows the empty state.
    fireEvent.change(search, { target: { value: "zebra-quux" } });
    expect(screen.getByText("No matching documents")).toBeInTheDocument();
  });

  it("filters by status via the Select, whose 'all' option reads 'All'", async () => {
    renderLibrary();
    await screen.findByText("Eloise and the Midnight Room-Service Caper");

    // The status filter is the shared Select (a listbox value picker, not a native
    // combobox); its trigger defaults to the "All" sentinel label.
    const filter = screen.getByRole("button", { name: /filter by status/i });
    expect(filter).toHaveTextContent("All");

    fireEvent.click(filter);
    fireEvent.click(screen.getByRole("option", { name: "Approved" }));

    // Only the caper is approved in the seed data.
    expect(
      screen.getByText("Eloise and the Midnight Room-Service Caper"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Rooftop idea")).not.toBeInTheDocument();
  });

  it("renders a Created time for each document row", async () => {
    renderLibrary();
    const caper = await screen.findByText("Eloise and the Midnight Room-Service Caper");
    const row = caper.closest("a");
    expect(row).not.toBeNull();
    // The row exposes a "Created …" relative time (mobile meta line).
    expect(row).toHaveTextContent(/Created /);
  });

  it("shows an error state for an unknown project", async () => {
    renderLibrary("proj-does-not-exist");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /project could not be found/i,
    );
  });
});
