import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusChip, STATUS_LABELS, STATUS_ORDER } from "./status-chip";

describe("StatusChip", () => {
  it.each(STATUS_ORDER)("renders the label for %s", (status) => {
    render(<StatusChip status={status} />);
    expect(screen.getByText(STATUS_LABELS[status])).toBeInTheDocument();
  });
});
