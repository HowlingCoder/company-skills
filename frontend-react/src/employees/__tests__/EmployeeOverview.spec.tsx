import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listEmployees } from "../../api/employee-api";
import { listSkills } from "../../api/skill-api";
import { bulkAssign } from "../../api/skill-assignment-api";
import { pickLevel, pickSkill } from "../../test/dialogs";
import type { Employee } from "../../api/models";
import { employees } from "../../test/fixtures";
import { renderWithProviders } from "../../test/render";
import { EmployeeOverview } from "../EmployeeOverview";
import { EMPLOYEES_KEY } from "../useEmployees";

vi.mock("../../api/employee-api");
vi.mock("../../api/skill-api", () => ({
  listSkills: vi.fn().mockResolvedValue([]),
}));
vi.mock("../../api/skill-assignment-api");
vi.mock("@mantine/notifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mantine/notifications")>()),
  notifications: { show: vi.fn() },
}));

/** Renders the overview; the first request answers with `body`. */
async function renderWith(body: Employee[]) {
  vi.mocked(listEmployees).mockResolvedValueOnce(body);
  const result = renderWithProviders(<EmployeeOverview />);
  await waitFor(() =>
    expect(screen.queryByLabelText("Loading employees")).toBeNull(),
  );
  return result;
}

function rows(): HTMLElement[] {
  const table = screen.queryByRole("table");
  return table ? within(table).getAllByRole("row").slice(1) : [];
}

function assignButtons(): HTMLElement[] {
  return screen.queryAllByRole("button", { name: /^Assign skill/ });
}

function assignButton(): HTMLElement {
  return assignButtons()[0]!;
}

async function tick(name: string): Promise<void> {
  await userEvent.click(screen.getByRole("checkbox", { name }));
}

describe("EmployeeOverview", () => {
  beforeEach(() => {
    vi.mocked(listEmployees).mockReset();
  });

  it("shows a spinner while the employees are loading", async () => {
    let answer!: (body: Employee[]) => void;
    vi.mocked(listEmployees).mockReturnValueOnce(
      new Promise((resolve) => (answer = resolve)),
    );
    renderWithProviders(<EmployeeOverview />);

    expect(screen.getByLabelText("Loading employees")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();

    answer([]);
    await waitFor(() =>
      expect(screen.queryByLabelText("Loading employees")).toBeNull(),
    );
  });

  it("loads the employees once when it is shown", async () => {
    await renderWith(employees);

    expect(listEmployees).toHaveBeenCalledOnce();
  });

  it("lists every employee with name, email, age and skill badges", async () => {
    await renderWith(employees);

    expect(rows()).toHaveLength(2);
    const first = within(rows()[0]!);
    expect(first.getByText("Max Muster")).toBeInTheDocument();
    expect(first.getByText("max.muster@example.com")).toBeInTheDocument();
    expect(first.getByText("34")).toBeInTheDocument();
    expect(first.getByText("Python 5")).toBeInTheDocument();
    expect(first.getByText("Docker 2")).toBeInTheDocument();
  });

  it("shows the empty state when there are no employees", async () => {
    await renderWith([]);

    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText("No employees yet")).toBeInTheDocument();
    expect(
      screen.getByText("Import a CSV file to add employees."),
    ).toBeInTheDocument();
  });

  it("offers the import in the empty state too", async () => {
    await renderWith([]);

    expect(screen.getAllByRole("button", { name: "Import CSV" })).toHaveLength(
      2,
    );
  });

  it("shows an error with a retry action when loading fails, and reloads on retry", async () => {
    vi.mocked(listEmployees).mockRejectedValueOnce(
      new Error("GET /api/employees failed: 500"),
    );
    renderWithProviders(<EmployeeOverview />);

    expect(
      await screen.findByText("Employees could not be loaded"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();

    vi.mocked(listEmployees).mockResolvedValueOnce(employees);
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(screen.queryByText("Employees could not be loaded")).toBeNull();
  });

  it("names the skills button of every row after the employee", async () => {
    await renderWith(employees);

    expect(
      screen.getByRole("button", { name: "Manage skills of Anna Schmidt" }),
    ).toBeInTheDocument();
  });

  it('enables "Assign skill" only with a selection and shows the number of rows', async () => {
    await renderWith(employees);
    expect(assignButton()).toBeDisabled();
    expect(assignButton()).toHaveTextContent(/^Assign skill$/);

    await tick("Select Max Muster");
    await tick("Select Anna Schmidt");

    expect(assignButton()).toBeEnabled();
    expect(assignButton()).toHaveTextContent("Assign skill (2)");
  });

  it("clears a row again when its checkbox is clicked a second time", async () => {
    await renderWith(employees);

    await tick("Select Max Muster");
    await tick("Select Max Muster");

    expect(
      screen.getByRole("checkbox", { name: "Select Max Muster" }),
    ).not.toBeChecked();
    expect(assignButton()).toBeDisabled();
  });

  it('tells why "Assign skill" is disabled until rows are selected', async () => {
    await renderWith(employees);
    expect(assignButton()).toHaveAttribute(
      "title",
      "Select employees in the table first",
    );

    await tick("Select Max Muster");

    expect(assignButton()).not.toHaveAttribute("title");
  });

  it("names the employee on every row checkbox", async () => {
    await renderWith(employees);

    const labels = rows().map((row) =>
      within(row).getByRole("checkbox").getAttribute("aria-label"),
    );
    expect(labels).toEqual(["Select Max Muster", "Select Anna Schmidt"]);
    expect(
      screen.getByRole("checkbox", { name: "Select all employees" }),
    ).toBeInTheDocument();
  });

  it("selects and clears all rows with the header checkbox", async () => {
    await renderWith(employees);

    await tick("Select all employees");
    expect(assignButton()).toHaveTextContent("Assign skill (2)");
    expect(
      screen.getByRole("checkbox", { name: "Select Anna Schmidt" }),
    ).toBeChecked();

    await tick("Select all employees");
    expect(assignButton()).toHaveTextContent(/^Assign skill$/);
  });

  it("marks the header checkbox as partly checked while only some rows are selected", async () => {
    await renderWith(employees);

    await tick("Select Max Muster");

    const selectAll = screen.getByRole("checkbox", {
      name: "Select all employees",
    });
    expect(selectAll).not.toBeChecked();
    expect(selectAll).toHaveAttribute("data-indeterminate", "true");
  });

  it('offers "Assign skill" again after the table while rows are selected', async () => {
    await renderWith(employees);
    expect(assignButtons()).toHaveLength(1);

    await tick("Select Anna Schmidt");

    expect(assignButtons()).toHaveLength(2);
    const afterTable = assignButtons()[1]!;
    expect(afterTable).toHaveTextContent("Assign skill (1)");
    expect(
      screen.getByRole("table").compareDocumentPosition(afterTable) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("does not count a selected employee who is gone after a reload", async () => {
    const { queryClient } = await renderWith(employees);
    await tick("Select Anna Schmidt");
    expect(assignButton()).toHaveTextContent("Assign skill (1)");

    vi.mocked(listEmployees).mockResolvedValueOnce([employees[0]!]);
    await queryClient.invalidateQueries({ queryKey: EMPLOYEES_KEY });

    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(assignButton()).toHaveTextContent(/^Assign skill$/);
    expect(assignButton()).toBeDisabled();
  });
  describe("search", () => {
    const matching: Employee[] = [
      {
        ...employees[0]!,
        skills: [
          {
            skill_id: "s1",
            name: "Python",
            alias: "py",
            proficiency_level: 5,
            matched: true,
          },
          {
            skill_id: "s2",
            name: "Docker",
            alias: null,
            proficiency_level: 2,
            matched: false,
          },
        ],
      },
    ];

    afterEach(() => window.history.replaceState(null, "", "/"));

    /** Opens the overview with the given query string; the first request answers with `body`. */
    async function openWith(query: string, body: Employee[]) {
      window.history.replaceState(null, "", `/${query}`);
      return renderWith(body);
    }

    /** Filter of the most recent request. */
    function lastRequest() {
      return vi.mocked(listEmployees).mock.lastCall?.[0];
    }

    function queryInput(): HTMLInputElement {
      return screen.getByRole("textbox", { name: "Filter by name or email" });
    }

    function minLevel(): HTMLInputElement {
      return screen.getByRole("combobox", { name: "Minimum level" });
    }

    async function chooseMinLevel(label: string): Promise<void> {
      await userEvent.click(minLevel());
      await userEvent.click(await screen.findByRole("option", { name: label }));
    }

    function pills(): string[] {
      const list = screen.queryByRole("list", { name: "Skills in the search" });
      return list
        ? within(list)
            .getAllByRole("listitem")
            .map((li) => li.textContent ?? "")
        : [];
    }

    it("loads with the filters of the URL and shows them in the filter bar", async () => {
      await openWith(
        "?q=mus&skills=python&skills=k8s&skill_match=or&min_level=3",
        matching,
      );

      expect(lastRequest()).toEqual({
        q: "mus",
        skills: ["python", "k8s"],
        skillMatch: "or",
        minLevel: 3,
      });
      expect(queryInput()).toHaveValue("mus");
      expect(pills()).toEqual(["python", "k8s"]);
      expect(screen.getByRole("radio", { name: "Any skill" })).toBeChecked();
      expect(minLevel()).toHaveValue("Min. level 3 (Intermediate)");
    });

    it("searches by name or email after a short typing pause and puts q in the URL", async () => {
      await renderWith(employees);
      vi.mocked(listEmployees).mockResolvedValue(matching);

      await userEvent.type(queryInput(), "mus");
      expect(queryInput()).toHaveValue("mus");
      expect(listEmployees).toHaveBeenCalledTimes(1);

      await waitFor(() => expect(listEmployees).toHaveBeenCalledTimes(2), {
        timeout: 1000,
      });
      expect(lastRequest()?.q).toBe("mus");
      expect(window.location.search).toBe("?q=mus");
    });

    it("keeps a space the user is still typing after the search started", async () => {
      await renderWith(employees);
      vi.mocked(listEmployees).mockResolvedValue(matching);

      await userEvent.type(queryInput(), "max ");
      await waitFor(() => expect(lastRequest()?.q).toBe("max"), { timeout: 1000 });

      expect(queryInput()).toHaveValue("max ");
    });

    it("drops URL values the backend would reject", async () => {
      await openWith(
        "?min_level=9&skill_match=maybe&skills=%20&q=%20max%20",
        employees,
      );

      expect(lastRequest()).toEqual({
        q: "max",
        skills: [],
        skillMatch: undefined,
        minLevel: undefined,
      });
    });

    it("writes a chosen minimum level to the URL and searches with it", async () => {
      await renderWith(employees);
      vi.mocked(listEmployees).mockResolvedValue(matching);

      await chooseMinLevel("Min. level 4 (Advanced)");

      await waitFor(() => expect(lastRequest()?.minLevel).toBe(4));
      expect(window.location.search).toBe("?min_level=4");
    });

    it("names every level in the minimum level selector", async () => {
      await renderWith(employees);

      await userEvent.click(minLevel());

      const options = await screen.findAllByRole("option");
      expect(options.map((option) => option.textContent)).toEqual([
        "Any level",
        "Min. level 1 (Beginner)",
        "Min. level 2 (Basic)",
        "Min. level 3 (Intermediate)",
        "Min. level 4 (Advanced)",
        "Min. level 5 (Expert)",
      ]);
    });

    it("adds a typed skill term with Enter, once only", async () => {
      await renderWith(employees);
      vi.mocked(listEmployees).mockResolvedValue(matching);
      const term = screen.getByRole("textbox", {
        name: "Add a skill to the search",
      });

      await userEvent.type(term, "kube*{Enter}");
      await userEvent.type(term, "KUBE*{Enter}");

      expect(pills()).toEqual(["kube*"]);
      expect(term).toHaveValue("");
      expect(window.location.search).toBe("?skills=kube*");
    });

    it("offers AND/OR only for several skills and sends OR when chosen", async () => {
      const { unmount } = await openWith("?skills=python", matching);
      expect(screen.queryByRole("radio", { name: "Any skill" })).toBeNull();
      unmount();

      await openWith("?skills=python&skills=docker", matching);
      await userEvent.click(screen.getByRole("radio", { name: "Any skill" }));

      await waitFor(() => expect(lastRequest()?.skillMatch).toBe("or"));
      expect(window.location.search).toBe(
        "?skills=python&skills=docker&skill_match=or",
      );
    });

    it("removes a skill from the search when its pill is deleted", async () => {
      await openWith("?skills=python&skills=docker&skill_match=or", matching);

      await userEvent.click(
        screen.getByRole("button", { name: "Remove python from the search" }),
      );

      // with one skill left, OR has no meaning any more
      await waitFor(() =>
        expect(lastRequest()).toMatchObject({
          skills: ["docker"],
          skillMatch: undefined,
        }),
      );
      expect(window.location.search).toBe("?skills=docker");
    });

    it("keeps the table visible while a search is running", async () => {
      await renderWith(employees);
      let answer!: (body: Employee[]) => void;
      vi.mocked(listEmployees).mockReturnValueOnce(
        new Promise((resolve) => (answer = resolve)),
      );

      await chooseMinLevel("Min. level 2 (Basic)");

      expect(screen.queryByLabelText("Loading employees")).toBeNull();
      expect(rows()).toHaveLength(2);
      answer(matching);
      await waitFor(() => expect(rows()).toHaveLength(1));
    });

    it("marks the skills that match the search", async () => {
      const { container } = await openWith("?skills=python", matching);

      const badges = container.querySelectorAll(".skill-badge");
      expect(badges[0]).toHaveClass("skill-matched");
      expect(badges[0]!.textContent).toContain("matches the search");
      expect(badges[1]).not.toHaveClass("skill-matched");
    });

    it("explains the wildcard when a skill search finds nobody", async () => {
      await openWith("?skills=kube", []);

      expect(screen.getByText(/e\.g\. kube\*/)).toBeInTheDocument();
    });

    it("does not mention the wildcard when no skill is part of the search", async () => {
      await openWith("?q=nobody", []);

      expect(
        screen.getByText("No employee fits the current filters."),
      ).toBeInTheDocument();
      expect(screen.queryByText(/kube\*/)).toBeNull();
    });

    it("offers to reset the filters when nothing matches, and clears URL and fields", async () => {
      await openWith("?q=nobody&min_level=5", []);
      expect(screen.getByText("No employees match")).toBeInTheDocument();
      expect(screen.queryByText("No employees yet")).toBeNull();
      vi.mocked(listEmployees).mockResolvedValue(employees);

      await userEvent.click(
        screen.getByRole("button", { name: "Reset filters" }),
      );

      await waitFor(() => expect(rows()).toHaveLength(2));
      expect(lastRequest()).toEqual({
        q: "",
        skills: [],
        skillMatch: undefined,
        minLevel: undefined,
      });
      expect(window.location.search).toBe("");
      expect(queryInput()).toHaveValue("");
      expect(minLevel()).toHaveValue("Any level");
    });

    it("clears the selection when a new search starts", async () => {
      await renderWith(employees);
      await tick("Select Max Muster");
      expect(assignButton()).toHaveTextContent("Assign skill (1)");
      vi.mocked(listEmployees).mockResolvedValue(employees);

      await chooseMinLevel("Min. level 3 (Intermediate)");

      await waitFor(() =>
        expect(assignButton()).toHaveTextContent(/^Assign skill$/),
      );
    });
  });
  describe("dialogs", () => {
    it("opens the import dialog from the button above the table", async () => {
      await renderWith(employees);

      await userEvent.click(
        screen.getAllByRole("button", { name: "Import CSV" })[0]!,
      );

      expect(
        screen.getByRole("dialog", { name: "Import employees" }),
      ).toBeInTheDocument();
    });

    it("offers the import dialog in the empty state too", async () => {
      await renderWith([]);

      await userEvent.click(
        screen.getAllByRole("button", { name: "Import CSV" })[1]!,
      );

      expect(
        screen.getByRole("dialog", { name: "Import employees" }),
      ).toBeInTheDocument();
    });

    it("closes a dialog on cancel", async () => {
      await renderWith(employees);
      await userEvent.click(
        screen.getAllByRole("button", { name: "Import CSV" })[0]!,
      );

      await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("opens the skills dialog for the employee of the clicked row", async () => {
      await renderWith(employees);

      await userEvent.click(
        screen.getByRole("button", { name: "Manage skills of Max Muster" }),
      );

      expect(
        screen.getByRole("dialog", { name: "Skills of Max Muster" }),
      ).toBeInTheDocument();
    });

    it("opens the assign dialog with the ticked employees", async () => {
      await renderWith(employees);
      await tick("Select Anna Schmidt");

      await userEvent.click(assignButton());

      const dialog = screen.getByRole("dialog", { name: "Assign skill" });
      expect(dialog).toHaveTextContent("Selected employees (1)");
      expect(dialog).toHaveTextContent("Anna Schmidt");
      expect(dialog).not.toHaveTextContent("Max Muster");
    });

    it("opens the assign dialog from the button after the table too", async () => {
      await renderWith(employees);
      await tick("Select all employees");

      await userEvent.click(assignButtons()[1]!);

      expect(
        screen.getByRole("dialog", { name: "Assign skill" }),
      ).toHaveTextContent("Selected employees (2)");
    });

    it("clears the selection and closes the dialog after a skill was assigned", async () => {
      vi.mocked(bulkAssign).mockResolvedValue({
        created: ["1"],
        updated: [],
        skipped: [],
      });
      vi.mocked(listSkills).mockResolvedValue([
        { id: "s9", name: "Go", alias: null, description: null },
      ]);
      await renderWith(employees);
      await tick("Select Anna Schmidt");
      await userEvent.click(assignButton());
      vi.mocked(listEmployees).mockResolvedValue(employees);

      await pickSkill(screen.getByLabelText("Skill"), {
        id: "s9",
        name: "Go",
        alias: null,
        description: null,
      });
      await pickLevel(
        screen.getByRole("combobox", { name: "Level" }),
        "2 - Basic",
      );
      await userEvent.click(screen.getByRole("button", { name: "Assign" }));

      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(assignButton()).toHaveTextContent(/^Assign skill$/);
      // the table is loaded again after the change
      await waitFor(() => expect(listEmployees).toHaveBeenCalledTimes(2));
    });
  });
});
