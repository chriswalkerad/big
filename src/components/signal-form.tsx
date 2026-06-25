"use client";

import { useId, useState } from "react";
import { Button } from "@/components/button";
import { cn } from "@/lib/utils";
import {
  SIGNAL_MODES,
  SIGNAL_MODE_LABELS,
  THRESHOLD_MAX,
  THRESHOLD_MIN,
  type SignalFormValues,
  isSignalMode,
  validateSignalForm,
} from "@/lib/signal-form";

export interface SignalFormProps {
  /** The current draft (controlled by the parent). */
  values: SignalFormValues;
  onChange: (values: SignalFormValues) => void;
  /** Called with a validated draft when Save is pressed. */
  onSubmit: (values: SignalFormValues) => void;
  onCancel: () => void;
  /** "create" mints a new signal; "edit" updates `editingSignal`. */
  mode: "create" | "edit";
  className?: string;
}

const fieldLabelClass = "text-label-sm font-medium text-text-primary";
const fieldErrorClass = "text-label-xs text-risk-text";

const controlClass = cn(
  "w-full rounded-control border border-border bg-bg px-3 py-2 text-body text-text-primary",
  "placeholder:text-text-tertiary transition-colors",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
);

/**
 * The single shared signal form, used for both create and edit. It is fully
 * controlled (the parent owns `values`) and validates with the pure helpers in
 * `@/lib/signal-form`. On Save it validates; if clean it forwards the draft,
 * otherwise it surfaces per-field errors and does not submit.
 */
export function SignalForm({
  values,
  onChange,
  onSubmit,
  onCancel,
  mode,
  className,
}: SignalFormProps) {
  const baseId = useId();
  const [showErrors, setShowErrors] = useState(false);

  const errors = validateSignalForm(values);
  const visible = showErrors ? errors : {};

  function set<K extends keyof SignalFormValues>(key: K, value: SignalFormValues[K]) {
    onChange({ ...values, [key]: value });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (Object.keys(errors).length > 0) {
      setShowErrors(true);
      return;
    }
    onSubmit(values);
  }

  const nameId = `${baseId}-name`;
  const promptId = `${baseId}-prompt`;
  const thresholdId = `${baseId}-threshold`;
  const modeId = `${baseId}-mode`;

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className={cn("flex flex-col gap-4", className)}
      aria-label={mode === "create" ? "Create signal" : "Edit signal"}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor={nameId} className={fieldLabelClass}>
          Name
        </label>
        <input
          id={nameId}
          type="text"
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
          required
          aria-required="true"
          aria-invalid={visible.name ? true : undefined}
          aria-describedby={visible.name ? `${nameId}-error` : undefined}
          className={controlClass}
          placeholder="Clarity"
        />
        {visible.name ? (
          <p id={`${nameId}-error`} role="alert" className={fieldErrorClass}>
            {visible.name}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={promptId} className={fieldLabelClass}>
          Prompt
        </label>
        <textarea
          id={promptId}
          value={values.prompt}
          onChange={(e) => set("prompt", e.target.value)}
          rows={5}
          required
          aria-required="true"
          aria-invalid={visible.prompt ? true : undefined}
          aria-describedby={visible.prompt ? `${promptId}-error` : undefined}
          className={cn(controlClass, "resize-y")}
          placeholder="Judge whether the concept reads clearly on a first pass…"
        />
        {visible.prompt ? (
          <p id={`${promptId}-error`} role="alert" className={fieldErrorClass}>
            {visible.prompt}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={thresholdId} className={fieldLabelClass}>
            Threshold ({THRESHOLD_MIN}–{THRESHOLD_MAX})
          </label>
          <input
            id={thresholdId}
            type="number"
            inputMode="numeric"
            min={THRESHOLD_MIN}
            max={THRESHOLD_MAX}
            step={1}
            value={values.threshold}
            onChange={(e) => set("threshold", e.target.value)}
            required
            aria-required="true"
            aria-invalid={visible.threshold ? true : undefined}
            aria-describedby={visible.threshold ? `${thresholdId}-error` : undefined}
            className={controlClass}
          />
          {visible.threshold ? (
            <p id={`${thresholdId}-error`} role="alert" className={fieldErrorClass}>
              {visible.threshold}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={modeId} className={fieldLabelClass}>
            Mode
          </label>
          <select
            id={modeId}
            value={values.mode}
            onChange={(e) => {
              const next = e.target.value;
              if (isSignalMode(next)) set("mode", next);
            }}
            aria-invalid={visible.mode ? true : undefined}
            aria-describedby={visible.mode ? `${modeId}-error` : undefined}
            className={controlClass}
          >
            {SIGNAL_MODES.map((m) => (
              <option key={m} value={m}>
                {SIGNAL_MODE_LABELS[m]}
              </option>
            ))}
          </select>
          {visible.mode ? (
            <p id={`${modeId}-error`} role="alert" className={fieldErrorClass}>
              {visible.mode}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-end gap-2">
        <Button type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="ink">
          {mode === "create" ? "Create signal" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
