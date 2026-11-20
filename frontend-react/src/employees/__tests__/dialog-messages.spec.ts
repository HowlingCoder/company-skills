import { describe, expect, it } from "vitest";
import type { Employee } from "../../api/models";
import {
  assignNotification,
  conflictHeading,
  findConflicts,
  importNotification,
  toSkillEntries,
  toSkillLevels,
} from "../dialog-messages";

const report = (imported: number, failed: number) => ({
  imported_count: imported,
  failed_count: failed,
  imported: [],
  errors: Array.from({ length: failed }, (_, i) => ({
    line: i + 2,
    message: "x",
  })),
});

const max: Employee = {
  id: "e1",
  firstname: "Max",
  lastname: "Muster",
  email: "max@example.com",
  age: 34,
  skills: [
    {
      skill_id: "s1",
      name: "Python",
      alias: "py",
      proficiency_level: 4,
      matched: false,
    },
  ],
};

describe("dialog messages", () => {
  it("words the import toast in the singular and plural", () => {
    expect(importNotification(report(1, 0)).message).toBe(
      "1 employee imported.",
    );
    expect(importNotification(report(3, 0)).message).toBe(
      "3 employees imported.",
    );
  });

  it("warns about a partial import and reports an empty file", () => {
    expect(importNotification(report(2, 1))).toMatchObject({
      color: "yellow",
      title: "Import incomplete",
    });
    expect(importNotification(report(0, 0))).toMatchObject({
      color: "blue",
      title: "Nothing to import",
    });
  });

  it("names the skill only when the assignment changed something", () => {
    expect(
      assignNotification("Go", { created: ["a"], updated: [], skipped: [] })
        .title,
    ).toBe("Go assigned");
    expect(
      assignNotification("Go", { created: [], updated: [], skipped: ["a"] })
        .title,
    ).toBe("Nothing changed");
  });

  it("turns the skills of an employee into rows and back", () => {
    const entries = toSkillEntries(max);

    expect(entries).toEqual([
      { skillId: "s1", label: "Python (py)", level: 4 },
    ]);
    expect(toSkillLevels(entries)).toEqual([
      { skill_id: "s1", proficiency_level: 4 },
    ]);
  });

  it("finds the employees who already have a skill", () => {
    expect(findConflicts([max], "s1")).toEqual([
      { employeeId: "e1", name: "Max Muster", level: 4 },
    ]);
    expect(findConflicts([max], "s2")).toEqual([]);
    expect(findConflicts([max], undefined)).toEqual([]);
  });

  it("words the conflict heading for one and several employees", () => {
    expect(conflictHeading(1)).toBe(
      "1 of the selected employees already has this skill",
    );
    expect(conflictHeading(2)).toBe(
      "2 of the selected employees already have this skill",
    );
  });
});
