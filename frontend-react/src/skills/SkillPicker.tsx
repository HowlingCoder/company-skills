import { Combobox, Text, TextInput, useCombobox } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import { type Ref, useEffect, useState } from "react";
import type { Skill } from "../api/models";
import { listSkills } from "../api/skill-api";
import { skillLabel } from "./levels";

/** Typing pause before the catalog is searched. */
const SEARCH_DELAY_MS = 200;

interface SkillPickerProps {
  id: string;
  /** Visible label; without one, pass aria-label. */
  label?: string;
  placeholder?: string;
  "aria-label"?: string;
  /** Skills that are not offered, e.g. because they are already assigned. */
  excludedSkillIds?: string[];
  /**
   * Lets Enter submit the typed text as it is, e.g. a wildcard like "c*". No suggestion is
   * preselected then, so Enter only picks a suggestion the user moved to.
   */
  allowFreeText?: boolean;
  /** Typed characters before suggestions open; 0 opens the list as soon as the input has focus. */
  minLength?: number;
  onSkillSelected?: (skill: Skill) => void;
  onTermEntered?: (term: string) => void;
  /** The input element, e.g. to focus it from outside. */
  ref?: Ref<HTMLInputElement>;
}

/** Text field with suggestions from the skill catalog, searched on the server. */
export function SkillPicker({
  id,
  label,
  placeholder = "Search the skill catalog",
  "aria-label": ariaLabel,
  excludedSkillIds = [],
  allowFreeText = false,
  minLength = 0,
  onSkillSelected,
  onTermEntered,
  ref,
}: SkillPickerProps) {
  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
  });
  const [text, setText] = useState("");
  const [searchText] = useDebouncedValue(text.trim(), SEARCH_DELAY_MS);
  const [focused, setFocused] = useState(false);

  // the query key holds the text, so an older, slower answer never replaces a newer one
  const { data: skills, isSuccess } = useQuery({
    queryKey: ["skills", searchText],
    queryFn: () => listSkills(searchText),
    enabled:
      focused && searchText.length >= minLength && text.trim() === searchText,
  });

  const searchDone =
    isSuccess && text.trim() === searchText && searchText.length >= minLength;
  const offered = searchDone
    ? skills.filter((skill) => !excludedSkillIds.includes(skill.id))
    : [];
  const emptyReason =
    !allowFreeText && searchDone && searchText && offered.length === 0
      ? skills.length
        ? "Already assigned."
        : "No matching skill in the catalog."
      : undefined;

  // without free text Enter picks the first suggestion, as in a plain autocomplete
  const firstOfferedId = offered[0]?.id;
  useEffect(() => {
    if (!allowFreeText && firstOfferedId) combobox.selectFirstOption();
  }, [allowFreeText, firstOfferedId, combobox]);

  function select(skillId: string): void {
    const skill = offered.find((candidate) => candidate.id === skillId);
    if (!skill) return;
    setText("");
    combobox.closeDropdown();
    onSkillSelected?.(skill);
  }

  function submitTerm(): void {
    const term = text.trim();
    if (!term) return;
    setText("");
    combobox.closeDropdown();
    onTermEntered?.(term);
  }

  return (
    <div>
      <Combobox store={combobox} onOptionSubmit={select}>
        <Combobox.Target>
          <TextInput
            ref={ref}
            id={id}
            label={label}
            placeholder={placeholder}
            aria-label={ariaLabel}
            value={text}
            onChange={(event) => {
              setText(event.currentTarget.value);
              combobox.openDropdown();
              combobox.resetSelectedOption();
            }}
            onFocus={() => {
              setFocused(true);
              combobox.openDropdown();
            }}
            onBlur={() => {
              setFocused(false);
              combobox.closeDropdown();
            }}
            onKeyDown={(event) => {
              // runs before the combobox: with a suggestion selected, the combobox picks it
              if (
                event.key === "Enter" &&
                allowFreeText &&
                combobox.getSelectedOptionIndex() === -1
              ) {
                event.preventDefault();
                submitTerm();
              }
            }}
          />
        </Combobox.Target>

        <Combobox.Dropdown hidden={offered.length === 0}>
          <Combobox.Options mah={300} style={{ overflowY: "auto" }}>
            {offered.map((skill) => (
              <Combobox.Option value={skill.id} key={skill.id}>
                {skillLabel(skill)}
              </Combobox.Option>
            ))}
          </Combobox.Options>
        </Combobox.Dropdown>
      </Combobox>

      {emptyReason && (
        <Text size="sm" c="dimmed" mt="xs" role="status">
          {emptyReason}
        </Text>
      )}
    </div>
  );
}
