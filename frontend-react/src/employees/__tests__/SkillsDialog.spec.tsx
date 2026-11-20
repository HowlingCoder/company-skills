import { notifications } from "@mantine/notifications";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setSkills } from "../../api/employee-api";
import { HttpError } from "../../api/http";
import type { Employee, Skill } from "../../api/models";
import { listSkills } from "../../api/skill-api";
import { pickLevel, pickSkill } from "../../test/dialogs";
import { renderWithProviders } from "../../test/render";
import { SkillsDialog } from "../SkillsDialog";
import { EMPLOYEES_KEY } from "../useEmployees";

vi.mock("../../api/employee-api");
vi.mock("../../api/skill-api");
vi.mock("@mantine/notifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mantine/notifications")>()),
  notifications: { show: vi.fn() },
}));

const employee: Employee = {
  id: "e1",
  firstname: "Max",
  lastname: "Muster",
  email: "max.muster@example.com",
  age: 34,
  skills: [
    {
      skill_id: "s1",
      name: "Python",
      alias: "py",
      proficiency_level: 5,
      matched: false,
    },
    {
      skill_id: "s2",
      name: "Docker",
      alias: null,
      proficiency_level: 2,
      matched: false,
    },
  ],
};
const kotlin: Skill = {
  id: "s3",
  name: "Kotlin",
  alias: null,
  description: null,
};

function render() {
  const onClose = vi.fn();
  const result = renderWithProviders(
    <SkillsDialog employee={employee} onClose={onClose} />,
  );
  const invalidate = vi.spyOn(result.queryClient, "invalidateQueries");
  return { onClose, invalidate };
}

function rows(): HTMLElement[] {
  const list = screen.queryByRole("list", { name: "Assigned skills" });
  return list ? within(list).getAllByRole("listitem") : [];
}

function level(label: string): HTMLElement {
  return screen.getByRole("combobox", { name: `Level of ${label}` });
}

function addInput(): HTMLElement {
  return screen.getByLabelText("Add skill");
}

async function click(name: string): Promise<void> {
  await userEvent.click(screen.getByRole("button", { name }));
}

describe("SkillsDialog", () => {
  beforeEach(() => {
    vi.mocked(setSkills).mockReset().mockResolvedValue(employee);
    vi.mocked(listSkills).mockReset().mockResolvedValue([]);
    vi.mocked(notifications.show).mockReset();
  });

  it("names the employee and lists the current skills with their levels", () => {
    render();

    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Skills of Max Muster",
    );
    expect(rows().map((row) => row.textContent)).toEqual([
      expect.stringContaining("Python (py)"),
      expect.stringContaining("Docker"),
    ]);
    expect(level("Python (py)")).toHaveValue("5 - Expert");
    expect(level("Docker")).toHaveValue("2 - Basic");
  });

  it('links the "Add skill" label to the picker input', () => {
    render();

    expect(addInput()).toHaveAttribute("id", "skills-dialog-add");
  });

  it("saves level changes, removals and additions as one full state", async () => {
    const { onClose, invalidate } = render();

    await pickLevel(level("Docker"), "3 - Intermediate");
    await click("Remove Python (py)");
    await pickSkill(addInput(), kotlin);
    await pickLevel(level("Kotlin"), "1 - Beginner");
    await click("Save");

    await waitFor(() =>
      expect(setSkills).toHaveBeenCalledWith("e1", [
        { skill_id: "s2", proficiency_level: 3 },
        { skill_id: "s3", proficiency_level: 1 },
      ]),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(invalidate).toHaveBeenCalledWith({ queryKey: EMPLOYEES_KEY });
  });

  it("sends an empty list when every skill was removed", async () => {
    render();

    await click("Remove Python (py)");
    await click("Remove Docker");
    expect(screen.getByText("No skills assigned yet.")).toBeInTheDocument();
    await click("Save");

    await waitFor(() => expect(setSkills).toHaveBeenCalledWith("e1", []));
  });

  it("blocks saving until a newly added skill has a level", async () => {
    render();

    await pickSkill(addInput(), kotlin);
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    await pickLevel(level("Kotlin"), "4 - Advanced");
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("keeps assigned skills out of the picker", async () => {
    render();
    vi.mocked(listSkills).mockResolvedValue([
      { id: "s1", name: "Python", alias: "py", description: null },
      kotlin,
    ]);

    await userEvent.click(addInput());

    expect(
      await screen.findByRole("option", { name: "Kotlin" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Python (py)" })).toBeNull();
  });

  it("shows the reason from the backend and stays open when a skill no longer exists", async () => {
    vi.mocked(setSkills).mockRejectedValue(
      new HttpError("x", 404, "Skill s9 not found"),
    );
    const { onClose } = render();

    await click("Save");

    expect(
      await screen.findByText("Skills could not be saved"),
    ).toBeInTheDocument();
    expect(screen.getByText("Skill s9 not found")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows a generic message when the server fails", async () => {
    vi.mocked(setSkills).mockRejectedValue(
      new HttpError("x", 500, "Traceback"),
    );
    render();

    await click("Save");

    expect(
      await screen.findByText(
        "The server did not answer as expected. Please try again.",
      ),
    ).toBeInTheDocument();
  });

  it("closes without a request on cancel", async () => {
    const { onClose } = render();

    await click("Cancel");

    expect(onClose).toHaveBeenCalledOnce();
    expect(setSkills).not.toHaveBeenCalled();
  });

  it("keeps the dialog open on Escape, so unsaved input is not lost", async () => {
    const { onClose } = render();

    await userEvent.keyboard("{Escape}");

    expect(onClose).not.toHaveBeenCalled();
  });

  it("confirms a successful save with a toast", async () => {
    render();

    await click("Save");

    await waitFor(() =>
      expect(notifications.show).toHaveBeenCalledWith(
        expect.objectContaining({
          color: "green",
          title: "Skills saved",
          message: "The skills of Max Muster were updated.",
        }),
      ),
    );
  });

  it("shows no toast when saving fails", async () => {
    vi.mocked(setSkills).mockRejectedValue(new Error("network"));
    render();

    await click("Save");

    await screen.findByText("Skills could not be saved");
    expect(notifications.show).not.toHaveBeenCalled();
  });

  describe("focus after removing a skill (bonus)", () => {
    it("moves the focus to the row that follows a removed skill", async () => {
      render();

      await click("Remove Python (py)");

      expect(
        screen.getByRole("button", { name: "Remove Docker" }),
      ).toHaveFocus();
    });

    it("moves the focus to the row before when the last skill is removed", async () => {
      render();

      await click("Remove Docker");

      expect(
        screen.getByRole("button", { name: "Remove Python (py)" }),
      ).toHaveFocus();
    });

    it('moves the focus to "Add skill" when no skill is left', async () => {
      render();

      await click("Remove Python (py)");
      await click("Remove Docker");

      expect(addInput()).toHaveFocus();
    });
  });
});
