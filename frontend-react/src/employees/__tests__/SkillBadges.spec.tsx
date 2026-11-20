import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { EmployeeSkill } from "../../api/models";
import { skillHue } from "../../skills/skill-hue";
import { renderWithProviders } from "../../test/render";
import { SkillBadges } from "../SkillBadges";

function skill(name: string, level: number, matched = false): EmployeeSkill {
  return {
    skill_id: name,
    name,
    alias: null,
    proficiency_level: level,
    matched,
  };
}

const sixSkills = [
  skill("A", 5),
  skill("B", 4),
  skill("C", 3),
  skill("D", 2),
  skill("E", 1),
  skill("F", 1),
];

function render(skills: EmployeeSkill[]) {
  return renderWithProviders(<SkillBadges skills={skills} />);
}

function badges(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(".skill-badge"));
}

function badgeTexts(root: ParentNode): string[] {
  return badges(root).map((badge) => badge.textContent?.trim() ?? "");
}

function overflowButton() {
  return screen.queryByRole("button", { name: /more skill/ });
}

describe("SkillBadges", () => {
  it("shows name and level on every badge, in the given order", () => {
    const { container } = render([
      skill("Python", 5),
      skill("Angular", 3),
      skill("Docker", 1),
    ]);

    expect(badgeTexts(container)).toEqual([
      "Python 5",
      "Angular 3",
      "Docker 1",
    ]);
  });

  it("marks each badge with the color step of its level", () => {
    const { container } = render([skill("Python", 5), skill("Docker", 1)]);

    expect(badges(container)[0]).toHaveClass("skill-level-5");
    expect(badges(container)[1]).toHaveClass("skill-level-1");
  });

  it("gives each badge the hue of its skill name, independent of the level", () => {
    const { container } = render([skill("Python", 5), skill("Docker", 5)]);

    const hues = badges(container).map((badge) =>
      badge.style.getPropertyValue("--skill-hue"),
    );
    expect(hues).toEqual([
      String(skillHue("Python")),
      String(skillHue("Docker")),
    ]);
    expect(hues[0]).not.toBe(hues[1]);
  });

  it("shows no overflow badge when all skills fit", () => {
    const { container } = render(sixSkills.slice(0, 4));

    expect(badgeTexts(container)).toHaveLength(4);
    expect(overflowButton()).toBeNull();
  });

  it("collapses skills beyond the fourth into a +N badge", () => {
    const { container } = render(sixSkills);

    expect(badgeTexts(container)).toEqual(["A 5", "B 4", "C 3", "D 2"]);
    expect(overflowButton()).toHaveTextContent("+2");
    expect(overflowButton()).toHaveAccessibleName("Show 2 more skills");
  });

  it("names a single hidden skill in the singular", () => {
    render(sixSkills.slice(0, 5));

    expect(overflowButton()).toHaveAccessibleName("Show 1 more skill");
  });

  it("opens a popover with the remaining skills when the +N badge is clicked", async () => {
    render(sixSkills);

    await userEvent.click(overflowButton()!);

    const popover = await screen.findByRole("dialog");
    expect(badgeTexts(popover)).toEqual(["E 1", "F 1"]);
  });

  it("shows skills that match the search first, so a match is never hidden in the popover", () => {
    const { container } = render([
      ...sixSkills.slice(0, 5),
      skill("F", 1, true),
    ]);

    expect(badgeTexts(container)).toHaveLength(4);
    expect(badgeTexts(container)[0]).toContain("F 1");
    expect(badges(container)[0]).toHaveClass("skill-matched");
    expect(badgeTexts(container).slice(1)).toEqual(["A 5", "B 4", "C 3"]);
    expect(overflowButton()).toHaveTextContent("+2");
  });

  it("tells screen readers which skill matches the search", () => {
    const { container } = render([
      skill("Python", 5, true),
      skill("Docker", 3),
    ]);

    expect(badges(container)[0]!.textContent).toContain("matches the search");
    expect(badges(container)[1]!.textContent).not.toContain(
      "matches the search",
    );
  });

  it("outlines the other skills when some match the search", () => {
    const { container } = render([
      skill("Python", 5, true),
      skill("Docker", 3),
      skill("Go", 1),
    ]);

    expect(badges(container)[0]).not.toHaveClass("skill-unmatched");
    expect(badges(container)[1]).toHaveClass("skill-unmatched");
    expect(badges(container)[2]).toHaveClass("skill-unmatched");
  });

  it("keeps every badge filled without a search", () => {
    const { container } = render([skill("Python", 5), skill("Docker", 3)]);

    expect(container.querySelectorAll(".skill-unmatched")).toHaveLength(0);
    expect(container.querySelectorAll(".skill-matched")).toHaveLength(0);
  });

  it("renders nothing for an employee without skills", () => {
    const { container } = render([]);

    expect(badgeTexts(container)).toEqual([]);
    expect(overflowButton()).toBeNull();
  });
});
