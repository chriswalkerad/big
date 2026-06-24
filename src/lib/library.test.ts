import { describe, it, expect } from "vitest";
import type { Document, SubmissionStatus } from "@/types";
import { ALL_STATUSES, filterDocuments, relativeTime } from "./library";

/** Build a Document with sensible defaults; override only what a test cares about. */
function makeDoc(overrides: Partial<Document> = {}): Document {
  return {
    id: "doc-1",
    projectId: "proj-eloise",
    title: "Untitled",
    body: "",
    subtype: "story_premise",
    subtypeSource: "auto",
    status: "draft",
    createdBy: "Maya Chen",
    createdAt: "2026-06-20T09:00:00.000Z",
    updatedAt: "2026-06-20T09:00:00.000Z",
    ...overrides,
  };
}

const caper = makeDoc({
  id: "doc-caper",
  title: "Midnight Room-Service Caper",
  body: "Eloise runs a secret midnight kitchen for sleepless guests.",
  status: "approved",
});
const friend = makeDoc({
  id: "doc-friend",
  title: "A New Friend",
  body: "A new kid moves into the Plaza and becomes a rival.",
  status: "submitted",
});
const elevator = makeDoc({
  id: "doc-elevator",
  title: "Haunted Service Elevator",
  body: "A vengeful bellhop drags guests into the shaft.",
  status: "changes_requested",
});

const docs: Document[] = [caper, friend, elevator];

describe("filterDocuments", () => {
  it("returns every document when no filter is supplied", () => {
    expect(filterDocuments(docs)).toEqual(docs);
    expect(filterDocuments(docs, {})).toEqual(docs);
  });

  it("matches on title (case-insensitive)", () => {
    expect(filterDocuments(docs, { query: "caper" })).toEqual([caper]);
    expect(filterDocuments(docs, { query: "HAUNTED" })).toEqual([elevator]);
  });

  it("matches on body text the title does not contain", () => {
    // "bellhop" appears only in the elevator body.
    expect(filterDocuments(docs, { query: "bellhop" })).toEqual([elevator]);
    // "sleepless" appears only in the caper body.
    expect(filterDocuments(docs, { query: "sleepless" })).toEqual([caper]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(filterDocuments(docs, { query: "zebra" })).toEqual([]);
  });

  it("treats a blank/whitespace query as no query", () => {
    expect(filterDocuments(docs, { query: "   " })).toEqual(docs);
    expect(filterDocuments(docs, { query: "" })).toEqual(docs);
  });

  it("filters to the correct subset by status", () => {
    expect(filterDocuments(docs, { status: "submitted" })).toEqual([friend]);
    expect(filterDocuments(docs, { status: "approved" })).toEqual([caper]);
    expect(filterDocuments(docs, { status: "draft" as SubmissionStatus })).toEqual([]);
  });

  it("treats the ALL_STATUSES sentinel as no status filter", () => {
    expect(filterDocuments(docs, { status: ALL_STATUSES })).toEqual(docs);
  });

  it("combines query and status (intersection)", () => {
    // "plaza" matches the friend body; status submitted also matches friend.
    expect(filterDocuments(docs, { query: "plaza", status: "submitted" })).toEqual([friend]);
    // "plaza" matches friend, but status approved does not — empty.
    expect(filterDocuments(docs, { query: "plaza", status: "approved" })).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const input = [...docs];
    filterDocuments(input, { query: "caper", status: "approved" });
    expect(input).toEqual(docs);
  });
});

describe("relativeTime", () => {
  const now = Date.parse("2026-06-23T12:00:00.000Z");

  it("renders sub-minute as 'just now'", () => {
    expect(relativeTime("2026-06-23T11:59:30.000Z", now)).toBe("just now");
  });

  it("renders minutes, hours, and days ago", () => {
    expect(relativeTime("2026-06-23T11:30:00.000Z", now)).toBe("30m ago");
    expect(relativeTime("2026-06-23T09:00:00.000Z", now)).toBe("3h ago");
    expect(relativeTime("2026-06-21T12:00:00.000Z", now)).toBe("2d ago");
  });

  it("falls back to a date beyond a week", () => {
    // 30 days earlier — should not contain 'ago'.
    expect(relativeTime("2026-05-24T12:00:00.000Z", now)).not.toMatch(/ago/);
  });

  it("returns an empty string for an unparseable timestamp", () => {
    expect(relativeTime("not-a-date", now)).toBe("");
  });
});
