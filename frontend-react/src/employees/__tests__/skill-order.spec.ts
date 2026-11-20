import { describe, expect, it } from "vitest";
import { type EmployeeSkill } from "../../api/models";
import { overflowLabel, splitSkills } from "../skill-order";

function skill(name: string, matched = false): EmployeeSkill {
  return { skill_id: name, name, alias: null, proficiency_level: 3, matched };
}

const names = (skills: EmployeeSkill[]) => skills.map((s) => s.name);

describe("splitSkills", () => {
  it("keeps the order of the backend and shows four badges at most", () => {
    const split = splitSkills(["A", "B", "C", "D", "E"].map((n) => skill(n)));

    expect(names(split.visible)).toEqual(["A", "B", "C", "D"]);
    expect(names(split.overflow)).toEqual(["E"]);
    expect(split.hasMatches).toBe(false);
  });

  it("moves matching skills to the front", () => {
    const split = splitSkills([
      skill("A"),
      skill("B"),
      skill("C"),
      skill("D"),
      skill("E", true),
    ]);

    expect(names(split.visible)).toEqual(["E", "A", "B", "C"]);
    expect(names(split.overflow)).toEqual(["D"]);
    expect(split.hasMatches).toBe(true);
  });

  it("handles an employee without skills", () => {
    expect(splitSkills([])).toEqual({
      visible: [],
      overflow: [],
      hasMatches: false,
    });
  });
});

describe("overflowLabel", () => {
  it("uses singular and plural", () => {
    expect(overflowLabel(1)).toBe("Show 1 more skill");
    expect(overflowLabel(3)).toBe("Show 3 more skills");
  });
});
