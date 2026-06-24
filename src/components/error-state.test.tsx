import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorState } from "./error-state";
import { appError, type AppErrorCode } from "@/lib/errors";

const CODES: AppErrorCode[] = [
  "AI_TIMEOUT",
  "AI_BAD_JSON",
  "AI_RATE_LIMIT",
  "NETWORK_OFFLINE",
  "STORAGE_UNAVAILABLE",
  "STORAGE_QUOTA",
  "DOC_NOT_FOUND",
  "EMPTY_DOC",
  "UNKNOWN",
];

describe("ErrorState", () => {
  it.each(CODES)("renders the human-readable message for %s", (code) => {
    const err = appError(code);
    const { unmount } = render(<ErrorState error={err} />);
    expect(screen.getByText(err.message)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveAttribute("data-error-code", code);
    unmount();
  });

  it("shows Retry only when the error is retryable and a handler is given", async () => {
    const onRetry = vi.fn();
    const { rerender } = render(<ErrorState error={appError("AI_TIMEOUT")} onRetry={onRetry} />);
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledOnce();

    // Non-retryable code → no button even with a handler.
    rerender(<ErrorState error={appError("EMPTY_DOC")} onRetry={onRetry} />);
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
  });

  it("shows no Retry when retryable but no handler is supplied", () => {
    render(<ErrorState error={appError("AI_RATE_LIMIT")} />);
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
  });
});
