import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

  it("links the New button to the new-document route", async () => {
    renderLibrary();
    await screen.findByText("Eloise and the Midnight Room-Service Caper");
    const newLink = screen.getByRole("link", { name: "New" });
    expect(newLink).toHaveAttribute("href", "/p/proj-eloise/d/new");
  });

  it("renders the project name as the page title", async () => {
    renderLibrary();
    const title = await screen.findByRole("heading", {
      level: 1,
      name: "Eloise at The Plaza",
    });
    expect(title).toBeInTheDocument();
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

  it("filters by status via the dropdown", async () => {
    renderLibrary();
    const filter = await screen.findByRole("combobox", { name: /filter by status/i });

    fireEvent.change(filter, { target: { value: "approved" } });
    // Only the caper is approved in the seed data.
    expect(
      screen.getByText("Eloise and the Midnight Room-Service Caper"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Rooftop idea")).not.toBeInTheDocument();
  });

  it("shows an error state for an unknown project", async () => {
    renderLibrary("proj-does-not-exist");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /project could not be found/i,
    );
  });
});
