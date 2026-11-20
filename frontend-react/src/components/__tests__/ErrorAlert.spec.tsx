import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/render";
import { ErrorAlert } from "../ErrorAlert";

describe("ErrorAlert", () => {
  it("shows title and message", () => {
    renderWithProviders(
      <ErrorAlert title="Could not load" message="Please try again." />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Could not load");
    expect(screen.getByRole("alert")).toHaveTextContent("Please try again.");
  });

  it("has no Retry button without a handler", () => {
    renderWithProviders(
      <ErrorAlert title="Could not load" message="Please try again." />,
    );

    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("calls the handler when Retry is clicked", async () => {
    const onRetry = vi.fn();
    renderWithProviders(
      <ErrorAlert
        title="Could not load"
        message="Please try again."
        onRetry={onRetry}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(onRetry).toHaveBeenCalledOnce();
  });
});
