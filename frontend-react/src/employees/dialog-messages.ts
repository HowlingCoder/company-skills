import type { NotificationData } from "@mantine/notifications";
import type {
  BulkAssignmentResult,
  Employee,
  ImportReport,
  SkillLevel,
} from "../api/models";
import { skillLabel } from "../skills/levels";
import { fullName } from "./employee-name";

/** Toast after an import; a partial import also keeps the dialog open with the failed rows. */
export function importNotification(report: ImportReport): NotificationData {
  if (report.failed_count > 0) {
    return {
      color: "yellow",
      title: "Import incomplete",
      message: `${report.imported_count} imported, ${report.failed_count} failed.`,
    };
  }
  if (report.imported_count === 0) {
    return {
      color: "blue",
      title: "Nothing to import",
      message: "The file contains no employees.",
    };
  }
  const noun = report.imported_count === 1 ? "employee" : "employees";
  return {
    color: "green",
    title: "Employees imported",
    message: `${report.imported_count} ${noun} imported.`,
  };
}

export function skillsSavedNotification(employee: Employee): NotificationData {
  return {
    color: "green",
    title: "Skills saved",
    message: `The skills of ${fullName(employee)} were updated.`,
  };
}

/** Toast after a bulk assignment: what the backend really did, even if nothing changed. */
export function assignNotification(
  skillName: string,
  result: BulkAssignmentResult,
): NotificationData {
  const changed = result.created.length + result.updated.length;
  return {
    color: changed ? "green" : "blue",
    title: changed ? `${skillName} assigned` : "Nothing changed",
    message:
      `${result.created.length} assigned, ${result.updated.length} updated, ` +
      `${result.skipped.length} skipped.`,
  };
}

/** One row of the skills dialog; level is null until one was picked for a new skill. */
export interface SkillEntry {
  skillId: string;
  label: string;
  level: number | null;
}

export function toSkillEntries(employee: Employee): SkillEntry[] {
  return employee.skills.map((skill) => ({
    skillId: skill.skill_id,
    label: skillLabel(skill),
    level: skill.proficiency_level,
  }));
}

/** The full skill state for PUT /employees/{id}/skills; every entry must have a level. */
export function toSkillLevels(entries: SkillEntry[]): SkillLevel[] {
  return entries.map((entry) => ({
    skill_id: entry.skillId,
    proficiency_level: entry.level!,
  }));
}

export interface Conflict {
  employeeId: string;
  name: string;
  level: number;
}

/**
 * Preview from the table data: who already has the chosen skill. The backend checks the
 * conflicts itself and reports what really happened.
 */
export function findConflicts(
  employees: Employee[],
  skillId: string | undefined,
): Conflict[] {
  if (!skillId) return [];
  return employees.flatMap((employee) => {
    const existing = employee.skills.find(
      (skill) => skill.skill_id === skillId,
    );
    return existing
      ? [
          {
            employeeId: employee.id,
            name: fullName(employee),
            level: existing.proficiency_level,
          },
        ]
      : [];
  });
}

export function conflictHeading(count: number): string {
  return `${count} of the selected employees already ${count === 1 ? "has" : "have"} this skill`;
}
