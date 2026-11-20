import { afterEach, describe, expect, it, vi } from "vitest";
import { type BulkAssignment, type BulkAssignmentResult } from "../models";
import { bulkAssign } from "../skill-assignment-api";
import { requestOf, respondWith } from "./fetch-mock";

const assignment: BulkAssignment = {
  employee_ids: ["e1", "e2"],
  skill_id: "s1",
  proficiency_level: 3,
};

describe("skill assignment API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps existing levels by default: no on_conflict param is sent", async () => {
    const outcome: BulkAssignmentResult = {
      created: ["e1"],
      updated: [],
      skipped: ["e2"],
    };
    const fetchMock = respondWith(outcome);

    const result = await bulkAssign(assignment);

    expect(requestOf(fetchMock)).toEqual({
      url: "/api/skill-assignments/bulk",
      method: "POST",
      body: assignment,
    });
    expect(result).toEqual(outcome);
  });

  it("asks for overwrite explicitly", async () => {
    const fetchMock = respondWith({
      created: [],
      updated: ["e1", "e2"],
      skipped: [],
    });

    await bulkAssign(assignment, true);

    expect(requestOf(fetchMock).url).toBe(
      "/api/skill-assignments/bulk?on_conflict=overwrite",
    );
  });
});
