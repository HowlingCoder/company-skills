import { notifications } from "@mantine/notifications";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../api/http";
import type { BulkAssignmentResult, Employee, Skill } from "../../api/models";
import { listSkills } from "../../api/skill-api";
import { bulkAssign } from "../../api/skill-assignment-api";
import { footerButtons, pickLevel, pickSkill } from "../../test/dialogs";
import { renderWithProviders } from "../../test/render";
import { AssignSkillDialog } from "../AssignSkillDialog";
import { EMPLOYEES_KEY } from "../useEmployees";

vi.mock("../../api/skill-assignment-api");
vi.mock("../../api/skill-api");
vi.mock("@mantine/notifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mantine/notifications")>()),
  notifications: { show: vi.fn() },
}));

function employee(
  id: string,
  firstname: string,
  lastname: string,
  skills: [string, number][] = [],
): Employee {
  return {
    id,
    firstname,
    lastname,
    email: `${firstname.toLowerCase()}@example.com`,
    age: 30,
    skills: skills.map(([skillId, level]) => ({
      skill_id: skillId,
      name: skillId,
      alias: null,
      proficiency_level: level,
      matched: false,
    })),
  };
}

const employees = [
  employee("e1", "Max", "Muster", [["s1", 4]]),
  employee("e2", "Anna", "Schmidt"),
  employee("e3", "Ida", "Zimmer", [["s1", 2]]),
];
const python: Skill = {
  id: "s1",
  name: "Python",
  alias: "py",
  description: null,
};
const docker: Skill = {
  id: "s2",
  name: "Docker",
  alias: null,
  description: null,
};

function result(
  created: number,
  updated = 0,
  skipped = 0,
): BulkAssignmentResult {
  const ids = (n: number, prefix: string) =>
    Array.from({ length: n }, (_, i) => `${prefix}${i}`);
  return {
    created: ids(created, "c"),
    updated: ids(updated, "u"),
    skipped: ids(skipped, "s"),
  };
}

function render(selected: Employee[] = employees) {
  const onClose = vi.fn();
  const onAssigned = vi.fn();
  const rendered = renderWithProviders(
    <AssignSkillDialog
      employees={selected}
      onClose={onClose}
      onAssigned={onAssigned}
    />,
  );
  const invalidate = vi.spyOn(rendered.queryClient, "invalidateQueries");
  return { onClose, onAssigned, invalidate };
}

function skillInput(): HTMLElement {
  return screen.getByLabelText("Skill");
}

function levelSelect(): HTMLElement {
  return screen.getByRole("combobox", { name: "Level" });
}

async function choose(skill: Skill, level: string): Promise<void> {
  await pickSkill(skillInput(), skill);
  await pickLevel(levelSelect(), level);
}

function conflictRows(): string[] {
  const list = screen.queryByRole("list", {
    name: "Employees who already have this skill",
  });
  return list
    ? within(list)
        .getAllByRole("listitem")
        .map((li) => li.textContent ?? "")
    : [];
}

describe("AssignSkillDialog", () => {
  beforeEach(() => {
    vi.mocked(bulkAssign).mockReset().mockResolvedValue(result(1));
    vi.mocked(listSkills).mockReset().mockResolvedValue([]);
    vi.mocked(notifications.show).mockReset();
  });

  it("lists the selected employees", () => {
    render();

    expect(screen.getByText("Selected employees (3)")).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Selected employees (3)" });
    expect(
      within(list)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["Max Muster", "Anna Schmidt", "Ida Zimmer"]);
  });

  it("links the labels to the skill and the level field", () => {
    render();

    expect(skillInput()).toHaveAttribute("id", "assign-skill-skill");
    expect(levelSelect()).toBeInTheDocument();
  });

  it("blocks assigning until a skill and a level are chosen", async () => {
    render();
    expect(screen.getByRole("button", { name: "Assign" })).toBeDisabled();

    await pickSkill(skillInput(), docker);
    expect(screen.getByRole("button", { name: "Assign" })).toBeDisabled();

    await pickLevel(levelSelect(), "3 - Intermediate");
    expect(screen.getByRole("button", { name: "Assign" })).toBeEnabled();
  });

  it("offers a single Assign button without conflicts and sends all employees", async () => {
    const { onAssigned, invalidate } = render();
    await choose(docker, "3 - Intermediate");

    expect(footerButtons()).toEqual(["Cancel", "Assign"]);
    await userEvent.click(screen.getByRole("button", { name: "Assign" }));

    await waitFor(() =>
      expect(bulkAssign).toHaveBeenCalledWith(
        {
          employee_ids: ["e1", "e2", "e3"],
          skill_id: "s2",
          proficiency_level: 3,
        },
        false,
      ),
    );
    await waitFor(() => expect(onAssigned).toHaveBeenCalledOnce());
    expect(invalidate).toHaveBeenCalledWith({ queryKey: EMPLOYEES_KEY });
  });

  it("shows who already has the skill and with which level", async () => {
    render();

    await pickSkill(skillInput(), python);

    expect(
      screen.getByText("2 of the selected employees already have this skill"),
    ).toBeInTheDocument();
    expect(conflictRows()).toEqual([
      "Max Muster: level 4",
      "Ida Zimmer: level 2",
    ]);
    expect(footerButtons()).toEqual([
      "Cancel",
      "Overwrite levels",
      "Keep existing levels",
    ]);
  });

  it("words the warning for a single employee who already has the skill", async () => {
    render([employees[0]!, employees[1]!]);

    await pickSkill(skillInput(), python);

    expect(
      screen.getByText("1 of the selected employees already has this skill"),
    ).toBeInTheDocument();
  });

  it("keeps existing levels by default: no overwrite is sent", async () => {
    render();
    await choose(python, "5 - Expert");

    await userEvent.click(
      screen.getByRole("button", { name: "Keep existing levels" }),
    );

    await waitFor(() =>
      expect(bulkAssign).toHaveBeenCalledWith(
        expect.objectContaining({ skill_id: "s1" }),
        false,
      ),
    );
  });

  it("overwrites existing levels only when asked explicitly", async () => {
    render();
    await choose(python, "5 - Expert");

    await userEvent.click(
      screen.getByRole("button", { name: "Overwrite levels" }),
    );

    await waitFor(() =>
      expect(bulkAssign).toHaveBeenCalledWith(
        expect.objectContaining({ proficiency_level: 5 }),
        true,
      ),
    );
  });

  it("reports what the backend did, even if nothing changed", async () => {
    vi.mocked(bulkAssign).mockResolvedValue(result(0, 0, 3));
    render();
    await choose(python, "2 - Basic");

    await userEvent.click(
      screen.getByRole("button", { name: "Keep existing levels" }),
    );

    await waitFor(() =>
      expect(notifications.show).toHaveBeenCalledWith(
        expect.objectContaining({
          color: "blue",
          title: "Nothing changed",
          message: "0 assigned, 0 updated, 3 skipped.",
        }),
      ),
    );
  });

  it("confirms a change with the name of the skill", async () => {
    vi.mocked(bulkAssign).mockResolvedValue(result(3));
    render();
    await choose(docker, "2 - Basic");

    await userEvent.click(screen.getByRole("button", { name: "Assign" }));

    await waitFor(() =>
      expect(notifications.show).toHaveBeenCalledWith(
        expect.objectContaining({ color: "green", title: "Docker assigned" }),
      ),
    );
  });

  it("lets the user change the chosen skill", async () => {
    render();
    await pickSkill(skillInput(), python);
    expect(screen.getByText("Python (py)")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Change" }));

    expect(skillInput()).toHaveValue("");
    expect(conflictRows()).toEqual([]);
  });

  it("shows the reason from the backend and stays open when an employee no longer exists", async () => {
    vi.mocked(bulkAssign).mockRejectedValue(
      new HttpError("x", 404, "Employee e2 not found"),
    );
    const { onAssigned, onClose } = render();
    await choose(docker, "2 - Basic");

    await userEvent.click(screen.getByRole("button", { name: "Assign" }));

    expect(
      await screen.findByText("Skill could not be assigned"),
    ).toBeInTheDocument();
    expect(screen.getByText("Employee e2 not found")).toBeInTheDocument();
    expect(onAssigned).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows a generic message when the server fails", async () => {
    vi.mocked(bulkAssign).mockRejectedValue(
      new HttpError("x", 500, "Traceback"),
    );
    render();
    await choose(docker, "2 - Basic");

    await userEvent.click(screen.getByRole("button", { name: "Assign" }));

    expect(
      await screen.findByText(
        "The server did not answer as expected. Please try again.",
      ),
    ).toBeInTheDocument();
  });

  it("closes without a request on cancel", async () => {
    const { onClose } = render();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(bulkAssign).not.toHaveBeenCalled();
  });

  it("keeps the dialog open on Escape, so a choice is not lost", async () => {
    const { onClose } = render();

    await userEvent.keyboard("{Escape}");

    expect(onClose).not.toHaveBeenCalled();
  });
});
