import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppBreadcrumb } from "./app-breadcrumb";

describe("AppBreadcrumb", () => {
  it("prepends a wired Account segment before the supplied segments", () => {
    render(
      <AppBreadcrumb
        segments={[{ label: "Eloise at The Plaza", current: true }]}
      />,
    );
    // Account is a button (the stub trigger); the project is rendered too.
    expect(screen.getByRole("button", { name: "Account" })).toBeInTheDocument();
    expect(screen.getByText("Eloise at The Plaza")).toBeInTheDocument();
  });

  it("does not show the Account popup until Account is clicked", () => {
    render(<AppBreadcrumb segments={[{ label: "Doc", current: true }]} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the popup with the explanatory text when Account is clicked", async () => {
    const user = userEvent.setup();
    render(<AppBreadcrumb segments={[{ label: "Doc", current: true }]} />);

    await user.click(screen.getByRole("button", { name: "Account" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(
      screen.getByText(/switch projects or manage the account/i),
    ).toBeInTheDocument();
  });

  it("is dismissable via the close button", async () => {
    const user = userEvent.setup();
    render(<AppBreadcrumb segments={[{ label: "Doc", current: true }]} />);

    await user.click(screen.getByRole("button", { name: "Account" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("is dismissable via the Escape key", async () => {
    const user = userEvent.setup();
    render(<AppBreadcrumb segments={[{ label: "Doc", current: true }]} />);

    await user.click(screen.getByRole("button", { name: "Account" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
