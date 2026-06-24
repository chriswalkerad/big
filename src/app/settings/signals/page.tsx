"use client";

// Signal admin — full CRUD over signal definitions (EPIC 13 / screen 4 of the
// frontend build spec). All reads and writes go through StorageRepository, which
// is the single source the review reads at submit time: deleting a signal here
// removes it from `listSignals()`, so the next review simply won't see it (no
// extra wiring, and we never cache a stale set — we re-read after every write).

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { SignalDef } from "@/types";
import { type AppError, toAppError } from "@/lib/errors";
import { createStorageRepository, type StorageRepository } from "@/lib/storage";
import {
  SIGNAL_MODE_LABELS,
  type SignalFormValues,
  emptySignalForm,
  signalToForm,
  toSignalDef,
} from "@/lib/signal-form";
import { AppBreadcrumb } from "@/components/app-breadcrumb";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { SignalForm } from "@/components/signal-form";
import { cn } from "@/lib/utils";

/** What, if anything, the editor panel is currently doing. */
type EditorState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; signal: SignalDef };

const primaryButtonClass = cn(
  "inline-flex h-9 items-center gap-1.5 rounded-control bg-accent px-3 text-label-sm font-medium text-bg",
  "transition-opacity hover:opacity-90",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
);

const iconButtonClass = cn(
  "inline-flex size-8 items-center justify-center rounded-control border border-border bg-surface text-text-secondary",
  "transition-colors hover:bg-panel hover:text-text-primary",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
);

/** Sort signals by name for a stable, predictable list. */
function sortSignals(list: readonly SignalDef[]): SignalDef[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name));
}

const emptySubscribe = () => () => {};

/** True on the client (after hydration), false during SSR/first render. */
function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

export default function SignalsAdminPage() {
  const [error, setError] = useState<AppError | null>(null);
  const [editor, setEditor] = useState<EditorState>({ kind: "closed" });
  const [form, setForm] = useState<SignalFormValues>(emptySignalForm);
  const [pendingDelete, setPendingDelete] = useState<SignalDef | null>(null);

  // Construct the repository once via a lazy initializer (runs on first render,
  // never re-created). It is SSR-safe (in-memory fallback) and seeds the six
  // signals on first run; on the client it is backed by localStorage. Errors are
  // surfaced through the onError callback into the typed ErrorState.
  const [repo] = useState<StorageRepository>(() =>
    createStorageRepository({ onError: setError }),
  );

  // The signal set, read straight from storage on first render and re-read after
  // every write — never a cached, stale copy. This IS the set the review reads.
  const [signals, setSignals] = useState<SignalDef[]>(() =>
    sortSignals(repo.listSignals()),
  );

  // Re-read the full set from storage after a mutation.
  const refresh = useCallback(() => {
    setSignals(sortSignals(repo.listSignals()));
  }, [repo]);

  const existingIds = useMemo(() => signals.map((s) => s.id), [signals]);

  // localStorage is only readable on the client, so until hydration we show the
  // shared LoadingState; this also keeps SSR and the first client render in sync.
  const mounted = useMounted();

  function openCreate() {
    setEditor({ kind: "create" });
    setForm(emptySignalForm());
  }

  function openEdit(signal: SignalDef) {
    setEditor({ kind: "edit", signal });
    setForm(signalToForm(signal));
  }

  function closeEditor() {
    setEditor({ kind: "closed" });
  }

  function handleSave(values: SignalFormValues) {
    try {
      const signal =
        editor.kind === "edit"
          ? toSignalDef(values, { id: editor.signal.id })
          : toSignalDef(values, { existingIds });
      repo.saveSignal(signal);
      refresh(); // re-read; do not splice a stale in-memory copy
      closeEditor();
    } catch (e) {
      setError(toAppError(e));
    }
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    try {
      repo.removeSignal(pendingDelete.id);
      refresh();
    } catch (e) {
      setError(toAppError(e));
    } finally {
      setPendingDelete(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <AppBreadcrumb
          segments={[{ label: "Settings · Signals", current: true }]}
        />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-heading text-text-primary">Signals</h1>
            <p className="text-body text-text-secondary">
              Define what every review checks. This set is the single source the
              review reads at submit time.
            </p>
          </div>
          <button type="button" onClick={openCreate} className={primaryButtonClass}>
            <Plus className="size-4" aria-hidden="true" />
            New Signal
          </button>
        </div>
      </div>

      {error ? (
        <ErrorState
          error={error}
          onRetry={
            error.retryable
              ? () => {
                  setError(null);
                  try {
                    refresh();
                  } catch (e) {
                    setError(toAppError(e));
                  }
                }
              : undefined
          }
        />
      ) : null}

      {!mounted ? (
        <LoadingState rows={6} label="Loading signals…" />
      ) : signals.length === 0 ? (
        <EmptyState
          title="No signals yet"
          description="Add a signal to start reviewing documents against it."
          action={
            <button type="button" onClick={openCreate} className={primaryButtonClass}>
              <Plus className="size-4" aria-hidden="true" />
              New Signal
            </button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Signals">
          {signals.map((signal) => (
            <li key={signal.id}>
              <div
                className={cn(
                  "flex items-center gap-3 rounded-card border border-border bg-surface px-4 py-3",
                  "transition-colors hover:bg-panel",
                )}
              >
                <button
                  type="button"
                  onClick={() => openEdit(signal)}
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-3 text-left",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-control",
                  )}
                  aria-label={`Open ${signal.name}`}
                >
                  <span className="min-w-0 flex-1 truncate text-body-emphasis text-text-primary">
                    {signal.name}
                  </span>
                  <ModeChip mode={signal.mode} />
                  <span className="shrink-0 text-label-sm text-text-secondary tabular-nums">
                    threshold {signal.threshold}
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEdit(signal)}
                    className={iconButtonClass}
                    aria-label={`Edit ${signal.name}`}
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(signal)}
                    className={iconButtonClass}
                    aria-label={`Delete ${signal.name}`}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editor.kind !== "closed" ? (
        <FormPanel
          title={editor.kind === "create" ? "New signal" : `Edit ${editor.signal.name}`}
          onClose={closeEditor}
        >
          <SignalForm
            values={form}
            onChange={setForm}
            onSubmit={handleSave}
            onCancel={closeEditor}
            mode={editor.kind === "create" ? "create" : "edit"}
          />
        </FormPanel>
      ) : null}

      {pendingDelete ? (
        <ConfirmDelete
          signal={pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </div>
  );
}

/** Neutral mode pill (inline / document), matching the chip aesthetic. */
function ModeChip({ mode }: { mode: SignalDef["mode"] }) {
  return (
    <span
      data-mode={mode}
      className="inline-flex shrink-0 items-center rounded-pill border border-border bg-panel px-2 py-0.5 text-label-xs uppercase text-text-tertiary"
    >
      {SIGNAL_MODE_LABELS[mode]}
    </span>
  );
}

/** A modal-style panel hosting the shared signal form (create or edit). */
function FormPanel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Overlay onDismiss={onClose} labelledBy="signal-form-title">
      <h2 id="signal-form-title" className="text-title text-text-primary">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </Overlay>
  );
}

/** Delete confirmation. Removal only happens on explicit confirm. */
function ConfirmDelete({
  signal,
  onCancel,
  onConfirm,
}: {
  signal: SignalDef;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Overlay onDismiss={onCancel} labelledBy="confirm-delete-title">
      <h2 id="confirm-delete-title" className="text-title text-text-primary">
        Delete signal
      </h2>
      <p className="mt-2 text-body text-text-secondary">
        Delete <span className="text-text-primary">{signal.name}</span>? Reviews
        run after this will no longer check it. This cannot be undone.
      </p>
      <div className="mt-5 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className={cn(
            "inline-flex h-9 items-center rounded-control border border-border bg-surface px-3 text-label-sm text-text-secondary",
            "transition-colors hover:bg-panel hover:text-text-primary",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          )}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-control bg-risk px-3 text-label-sm font-medium text-bg",
            "transition-opacity hover:opacity-90",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-risk focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
          )}
        >
          <Trash2 className="size-4" aria-hidden="true" />
          Delete
        </button>
      </div>
    </Overlay>
  );
}

/** Shared dismissable overlay shell (backdrop + centered dialog card). */
function Overlay({
  children,
  onDismiss,
  labelledBy,
}: {
  children: React.ReactNode;
  onDismiss: () => void;
  labelledBy: string;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onDismiss();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="absolute inset-0 size-full cursor-default bg-text-primary/30 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-lg rounded-card border border-border bg-bg p-6 shadow-lg">
        {children}
      </div>
    </div>
  );
}
