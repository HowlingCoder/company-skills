import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Skill } from "../../api/models";
import { listSkills } from "../../api/skill-api";
import { renderWithProviders } from "../../test/render";
import { SkillPicker } from "../SkillPicker";

vi.mock("../../api/skill-api");

const kubernetes: Skill = {
  id: "s1",
  name: "Kubernetes",
  alias: "K8s",
  description: null,
};
const kotlin: Skill = {
  id: "s2",
  name: "Kotlin",
  alias: null,
  description: null,
};

type Props = Partial<Parameters<typeof SkillPicker>[0]>;

function render(props: Props = {}) {
  const onSkillSelected = vi.fn<(skill: Skill) => void>();
  const onTermEntered = vi.fn<(term: string) => void>();
  renderWithProviders(
    <SkillPicker
      id="picker"
      aria-label="Skill"
      onSkillSelected={onSkillSelected}
      onTermEntered={onTermEntered}
      {...props}
    />,
  );
  return { onSkillSelected, onTermEntered };
}

function input(): HTMLInputElement {
  return screen.getByLabelText("Skill");
}

function optionTexts(): string[] {
  return screen
    .queryAllByRole("option")
    .map((option) => option.textContent ?? "");
}

/** Types into the picker and lets the catalog lookup answer with `result`. */
async function search(term: string, result: Skill[]): Promise<void> {
  vi.mocked(listSkills).mockResolvedValue(result);
  await userEvent.type(input(), term);
  await waitFor(() => expect(listSkills).toHaveBeenLastCalledWith(term));
  // let the answer render
  await waitFor(() =>
    expect(vi.mocked(listSkills).mock.results.at(-1)?.type).toBe("return"),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("SkillPicker", () => {
  beforeEach(() => {
    vi.mocked(listSkills).mockReset().mockResolvedValue([]);
  });

  it("searches the catalog on the server and shows name and alias", async () => {
    render();

    await search("k", [kotlin, kubernetes]);

    await waitFor(() =>
      expect(optionTexts()).toEqual(["Kotlin", "Kubernetes (K8s)"]),
    );
  });

  it("searches only after a typing pause, not for every keystroke", async () => {
    render({ minLength: 1 });

    await search("kub", [kubernetes]);

    expect(listSkills).not.toHaveBeenCalledWith("k");
    expect(listSkills).not.toHaveBeenCalledWith("ku");
  });

  it("does not offer skills that are excluded", async () => {
    render({ excludedSkillIds: ["s1"] });

    await search("k", [kotlin, kubernetes]);

    await waitFor(() => expect(optionTexts()).toEqual(["Kotlin"]));
  });

  it("reports the chosen skill and clears the input", async () => {
    const { onSkillSelected } = render();
    await search("kub", [kubernetes]);

    await userEvent.click(
      await screen.findByRole("option", { name: "Kubernetes (K8s)" }),
    );

    expect(onSkillSelected).toHaveBeenCalledWith(kubernetes);
    expect(input()).toHaveValue("");
  });

  it("picks the first suggestion on Enter", async () => {
    const { onSkillSelected } = render();
    await search("k", [kotlin, kubernetes]);
    await screen.findByRole("option", { name: "Kotlin" });

    await userEvent.keyboard("{Enter}");

    expect(onSkillSelected).toHaveBeenCalledWith(kotlin);
  });

  it("offers the whole catalog, not only the first matches", async () => {
    render();
    const catalog: Skill[] = Array.from({ length: 25 }, (_, index) => ({
      id: `c${index}`,
      name: `Skill ${index}`,
      alias: null,
      description: null,
    }));

    await search("skill", catalog);

    await waitFor(() => expect(optionTexts()).toHaveLength(25));
  });

  it("says so when the typed text matches no skill", async () => {
    render();

    await search("cobol", []);

    expect(await screen.findByRole("status")).toHaveTextContent(
      "No matching skill in the catalog.",
    );
  });

  it("says so when every match is excluded, e.g. already assigned", async () => {
    render({ excludedSkillIds: ["s1"] });

    await search("kub", [kubernetes]);

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Already assigned.",
    );
    expect(optionTexts()).toHaveLength(0);
  });

  it("shows no hint while a match is left next to an excluded one", async () => {
    render({ excludedSkillIds: ["s1"] });

    await search("k", [kotlin, kubernetes]);

    await screen.findByRole("option", { name: "Kotlin" });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("waits for the minimum length before it looks up suggestions", async () => {
    render({ minLength: 2 });
    vi.mocked(listSkills).mockResolvedValue([kotlin]);

    await userEvent.type(input(), "k");
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(listSkills).not.toHaveBeenCalled();
    expect(optionTexts()).toHaveLength(0);
  });

  it("does not submit free text unless it is allowed", async () => {
    const { onTermEntered } = render();
    await search("zzz", []);

    await userEvent.keyboard("{Enter}");

    expect(onTermEntered).not.toHaveBeenCalled();
    expect(input()).toHaveValue("zzz");
  });

  it("can be focused from outside", () => {
    const ref = createRef<HTMLInputElement>();
    render({ ref });

    ref.current?.focus();

    expect(document.activeElement).toBe(input());
  });

  describe("with free text", () => {
    it("submits the typed text on Enter, e.g. a wildcard, and clears the input", async () => {
      const { onSkillSelected, onTermEntered } = render({
        allowFreeText: true,
      });
      await search("c*", []);

      await userEvent.keyboard("{Enter}");

      expect(onTermEntered).toHaveBeenCalledWith("c*");
      expect(onSkillSelected).not.toHaveBeenCalled();
      expect(input()).toHaveValue("");
    });

    it("does not pick the first suggestion on Enter", async () => {
      const { onSkillSelected, onTermEntered } = render({
        allowFreeText: true,
      });
      await search("k", [kotlin, kubernetes]);
      await screen.findByRole("option", { name: "Kotlin" });

      await userEvent.keyboard("{Enter}");

      expect(onTermEntered).toHaveBeenCalledWith("k");
      expect(onSkillSelected).not.toHaveBeenCalled();
    });

    it("picks a suggestion the user moved to with the arrow keys", async () => {
      const { onSkillSelected, onTermEntered } = render({
        allowFreeText: true,
      });
      await search("k", [kotlin, kubernetes]);
      await screen.findByRole("option", { name: "Kotlin" });

      await userEvent.keyboard("{ArrowDown}{Enter}");

      expect(onSkillSelected).toHaveBeenCalledWith(kotlin);
      expect(onTermEntered).not.toHaveBeenCalled();
    });

    it("ignores Enter on an empty input", async () => {
      const { onTermEntered } = render({ allowFreeText: true });

      await userEvent.click(input());
      await userEvent.keyboard("{Enter}");

      expect(onTermEntered).not.toHaveBeenCalled();
    });

    it("shows no hint, where a term like a wildcard needs no match", async () => {
      render({ allowFreeText: true });

      await search("c*", []);

      expect(screen.queryByRole("status")).toBeNull();
    });
  });
});
