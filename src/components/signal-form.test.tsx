import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
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
