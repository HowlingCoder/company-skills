import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, vi } from "vitest";
import type { Skill } from "../api/models";
import { listSkills } from "../api/skill-api";

/** Labels of the buttons in the dialog footer, in order. */
export function footerButtons(): string[] {
  const footer = screen
    .getByRole("dialog")
    .querySelector("[data-dialog-footer]");
  return Array.from(footer?.querySelectorAll("button") ?? []).map(
    (button) => button.textContent?.trim() ?? "",
  );
}

/** Types into a SkillPicker and clicks the suggestion; needs vi.mock of the skill api. */
export async function pickSkill(
  input: HTMLElement,
  skill: Skill,
): Promise<void> {
  vi.mocked(listSkills).mockResolvedValue([skill]);
  await userEvent.type(input, skill.name);
  const option = await screen.findByRole("option", {
    name: new RegExp(`^${skill.name}`),
  });
  await userEvent.click(option);
  await waitFor(() => expect(screen.queryByRole("option")).toBeNull());
}

/** Picks a level in a LevelSelect. */
export async function pickLevel(
  select: HTMLElement,
  label: string,
): Promise<void> {
  await userEvent.click(select);
  await userEvent.click(await screen.findByRole("option", { name: label }));
}
