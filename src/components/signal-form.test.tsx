import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignalForm } from "./signal-form";
import { emptySignalForm, type SignalFormValues } from "@/lib/signal-form";

/** Controlled harness mirroring how the admin page drives the form. */
function Harness({
  initial,
  mode,
  onSubmit,
}: {
  initial: SignalFormValues;
  mode: "create" | "edit";
  onSubmit: (v: SignalFormValues) => void;
}) {
  const [values, setValues] = useState(initial);
  return (
    <SignalForm
      values={values}
      onChange={setValues}
      onSubmit={onSubmit}
      onCancel={() => {}}
      mode={mode}
    />
  );
}

describe("SignalForm", () => {
  it("does not submit and shows errors when the draft is invalid", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness initial={emptySignalForm()} mode="create" onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: "Create signal" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Name is required.")).toBeInTheDocument();
    expect(screen.getByText("Prompt is required.")).toBeInTheDocument();
  });

  it("submits a valid draft", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness initial={emptySignalForm()} mode="create" onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Name"), "Tone");
    await user.type(screen.getByLabelText("Prompt"), "Judge the tone.");
    await user.click(screen.getByRole("button", { name: "Create signal" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      name: "Tone",
      prompt: "Judge the tone.",
      mode: "inline",
    });
  });

  it("picks the mode via the Select dropdown", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness initial={emptySignalForm()} mode="create" onSubmit={onSubmit} />);

    // The mode picker is the shared Select listbox; its accessible name composes the
    // visible "Mode" label with the current value ("Inline" by default).
    const modeTrigger = screen.getByRole("button", { name: /mode\s+inline/i });
    expect(modeTrigger).toHaveAttribute("aria-haspopup", "listbox");
    expect(modeTrigger).toHaveTextContent("Inline");

    await user.click(modeTrigger);
    await user.click(screen.getByRole("option", { name: /document/i }));

    await user.type(screen.getByLabelText("Name"), "Tone");
    await user.type(screen.getByLabelText("Prompt"), "Judge the tone.");
    await user.click(screen.getByRole("button", { name: "Create signal" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ mode: "doc" });
  });

  it("associates the visible Mode label with the picker (3.3.2 parity)", () => {
    render(<Harness initial={emptySignalForm()} mode="create" onSubmit={() => {}} />);

    // The picker's name is composed from the visible "Mode" label + current value,
    // mirroring how the other fields associate their <label>.
    const modeLabel = screen.getByText("Mode");
    const modeTrigger = screen.getByRole("button", { name: /mode\s+inline/i });
    expect(modeTrigger.getAttribute("aria-labelledby")).toContain(modeLabel.id);
  });

  it("moves focus to the first invalid control on a failed submit (#12)", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness initial={emptySignalForm()} mode="create" onSubmit={onSubmit} />);

    // Name + Prompt are empty, so submitting surfaces both errors. Focus must land
    // on the first invalid control (Name) so its label + error are read together,
    // rather than staying on Save.
    await user.click(screen.getByRole("button", { name: "Create signal" }));

    await waitFor(() => expect(screen.getByLabelText("Name")).toHaveFocus());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("prefixes each field error alert with its field name (#12)", async () => {
    const user = userEvent.setup();
    render(<Harness initial={emptySignalForm()} mode="create" onSubmit={() => {}} />);

    await user.click(screen.getByRole("button", { name: "Create signal" }));

    // The visible message is unchanged, but the alert carries an sr-only field
    // prefix so the burst of alerts is self-describing.
    const nameError = screen.getByText("Name is required.").closest("[role=alert]");
    expect(nameError).toHaveTextContent("Name: Name is required.");
  });

  it("flags an out-of-range threshold", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <Harness
        initial={{ name: "T", prompt: "p", threshold: "150", mode: "doc" }}
        mode="edit"
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/between 0 and 100/i)).toBeInTheDocument();
  });
});
