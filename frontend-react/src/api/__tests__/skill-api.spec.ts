import { afterEach, describe, expect, it, vi } from "vitest";
import { type Skill } from "../models";
import { listSkills } from "../skill-api";
import { requestOf, respondWith } from "./fetch-mock";

describe("skill API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("requests the whole catalog when no search term is given", async () => {
    const skills: Skill[] = [
      {
        id: "7b0c1f0e-0000-4000-8000-000000000002",
        name: "Kubernetes",
        alias: "K8s",
        description: null,
      },
    ];
    const fetchMock = respondWith(skills);

    const result = await listSkills();

    expect(requestOf(fetchMock)).toMatchObject({
      url: "/api/skills",
      method: "GET",
    });
    expect(result).toEqual(skills);
  });

  it("sends the trimmed search term as q", async () => {
    const fetchMock = respondWith([]);

    await listSkills(" py ");

    expect(requestOf(fetchMock).url).toBe("/api/skills?q=py");
  });
});
