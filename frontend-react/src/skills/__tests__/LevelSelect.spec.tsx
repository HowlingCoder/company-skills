import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/render";
import { LevelSelect } from "../LevelSelect";

describe("LevelSelect", () => {
  it("offers the five levels with their names", async () => {
    renderWithProviders(<LevelSelect value={null} onChange={() => {}} />);

    await userEvent.click(screen.getByRole("combobox", { name: "Level" }));

    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "1 - Beginner",
      "2 - Basic",
      "3 - Intermediate",
      "4 - Advanced",
      "5 - Expert",
    ]);
  });

  it("reports the chosen level as a number", async () => {
    const onChange = vi.fn();
    renderWithProviders(<LevelSelect value={null} onChange={onChange} />);

    await userEvent.click(screen.getByRole("combobox", { name: "Level" }));
    await userEvent.click(
      await screen.findByRole("option", { name: "4 - Advanced" }),
    );

    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("shows the current level", () => {
    renderWithProviders(<LevelSelect value={3} onChange={() => {}} />);

    expect(screen.getByRole("combobox", { name: "Level" })).toHaveValue(
      "3 - Intermediate",
    );
  });

  it("shows a placeholder without a level", () => {
    renderWithProviders(<LevelSelect value={null} onChange={() => {}} />);

    expect(screen.getByRole("combobox", { name: "Level" })).toHaveValue("");
    expect(screen.getByPlaceholderText("Select level")).toBeInTheDocument();
  });
});
