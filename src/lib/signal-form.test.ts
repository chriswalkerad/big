import { describe, it, expect } from "vitest";
import type { SignalDef } from "@/types";
import {
  emptySignalForm,
  isSignalFormValid,
  isSignalMode,
  nextSignalId,
  signalToForm,
  slugifySignalId,
  toSignalDef,
  validateSignalForm,
  type SignalFormValues,
} from "./signal-form";

const valid: SignalFormValues = {
  name: "Clarity",
  prompt: "Judge whether it reads clearly.",
  threshold: "7",
  mode: "inline",
};

describe("validateSignalForm", () => {
  it("accepts a complete, valid draft", () => {
    expect(validateSignalForm(valid)).toEqual({});
    expect(isSignalFormValid(valid)).toBe(true);
  });

  it("requires a name", () => {
    expect(validateSignalForm({ ...valid, name: "   " }).name).toBeDefined();
  });

  it("requires a prompt", () => {
    expect(validateSignalForm({ ...valid, prompt: "" }).prompt).toBeDefined();
  });

  it("requires a threshold", () => {
    expect(validateSignalForm({ ...valid, threshold: "" }).threshold).toBeDefined();
  });

  it("rejects a non-integer threshold", () => {
    expect(validateSignalForm({ ...valid, threshold: "7.5" }).threshold).toBeDefined();
    expect(validateSignalForm({ ...valid, threshold: "abc" }).threshold).toBeDefined();
  });

  it("rejects a threshold outside 0–10", () => {
    expect(validateSignalForm({ ...valid, threshold: "-1" }).threshold).toBeDefined();
    expect(validateSignalForm({ ...valid, threshold: "11" }).threshold).toBeDefined();
  });

  it("accepts the boundary thresholds 0 and 10", () => {
    expect(validateSignalForm({ ...valid, threshold: "0" }).threshold).toBeUndefined();
    expect(validateSignalForm({ ...valid, threshold: "10" }).threshold).toBeUndefined();
  });

  it("rejects an unknown mode", () => {
    expect(
      validateSignalForm({ ...valid, mode: "weird" as SignalFormValues["mode"] }).mode,
    ).toBeDefined();
  });
});

describe("isSignalMode", () => {
  it("recognises inline and doc, rejects others", () => {
    expect(isSignalMode("inline")).toBe(true);
    expect(isSignalMode("doc")).toBe(true);
    expect(isSignalMode("block")).toBe(false);
  });
});

describe("slugifySignalId / nextSignalId", () => {
  it("slugifies a name to lowercase hyphenated", () => {
    expect(slugifySignalId("Brand Safety")).toBe("brand-safety");
    expect(slugifySignalId("  Hook!! Strength  ")).toBe("hook-strength");
  });

  it("falls back to 'signal' for an unusable name", () => {
    expect(slugifySignalId("!!!")).toBe("signal");
  });

  it("picks a non-colliding id", () => {
    expect(nextSignalId("Clarity", [])).toBe("clarity");
    expect(nextSignalId("Clarity", ["clarity"])).toBe("clarity-2");
    expect(nextSignalId("Clarity", ["clarity", "clarity-2"])).toBe("clarity-3");
  });
});

describe("signalToForm / emptySignalForm", () => {
  it("round-trips a SignalDef into editable strings", () => {
    const def: SignalDef = {
      id: "x",
      name: "X",
      prompt: "p",
      threshold: 5,
      mode: "doc",
    };
    expect(signalToForm(def)).toEqual({
      name: "X",
      prompt: "p",
      threshold: "5",
      mode: "doc",
    });
  });

  it("starts blank in create mode", () => {
    const empty = emptySignalForm();
    expect(empty.name).toBe("");
    expect(empty.prompt).toBe("");
    expect(isSignalMode(empty.mode)).toBe(true);
  });
});

describe("toSignalDef", () => {
  it("mints a new id from the name in create mode", () => {
    const def = toSignalDef(valid, { existingIds: ["clarity"] });
    expect(def).toEqual({
      id: "clarity-2",
      name: "Clarity",
      prompt: "Judge whether it reads clearly.",
      threshold: 7,
      mode: "inline",
    });
  });

  it("preserves the id in edit mode and trims fields", () => {
    const def = toSignalDef(
      { ...valid, name: "  Clarity  ", prompt: "  judge  " },
      { id: "clarity" },
    );
    expect(def.id).toBe("clarity");
    expect(def.name).toBe("Clarity");
    expect(def.prompt).toBe("judge");
    expect(def.threshold).toBe(7);
  });

  it("throws on an invalid draft", () => {
    expect(() => toSignalDef({ ...valid, name: "" })).toThrow();
  });
});
