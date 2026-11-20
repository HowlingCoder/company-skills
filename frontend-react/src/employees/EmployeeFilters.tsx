import {
  Box,
  Group,
  Pill,
  SegmentedControl,
  Select,
  TextInput,
} from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { PROFICIENCY_LEVELS } from "../skills/levels";
import { SkillPicker } from "../skills/SkillPicker";
import {
  type ActiveFilter,
  SEARCH_DEBOUNCE_MS,
  withoutSkill,
  withSkill,
} from "./employee-filter-url";

interface EmployeeFiltersProps {
  filter: ActiveFilter;
  /** Called with the complete new filter; the parent decides where it is stored. */
  onChange: (filter: ActiveFilter) => void;
}

// "0" stands for "any level": the Select needs a value for that option too
const levelOptions = [
  { value: "0", label: "Any level" },
  ...PROFICIENCY_LEVELS.map((level) => ({
    value: String(level.value),
    label: `Min. level ${level.value} (${level.name})`,
  })),
];

const skillMatchOptions = [
  { value: "and", label: "All skills" },
  { value: "or", label: "Any skill" },
];

/** Filter bar above the table; shows `filter` and reports every change through `onChange`. */
export function EmployeeFilters({ filter, onChange }: EmployeeFiltersProps) {
  const [query, setQuery] = useState(filter.q);

  // the filter can change from outside (Reset filters), then the field follows;
  // a trailing space the user is still typing stays
  const [prevQ, setPrevQ] = useState(filter.q);
  if (filter.q !== prevQ) {
    setPrevQ(filter.q);
    if (filter.q !== query.trim()) setQuery(filter.q);
  }

  // the field updates at once, the filter only after the typing pause
  useEffect(() => {
    const timer = setTimeout(() => {
      const q = query.trim();
      if (q !== filter.q) onChange({ ...filter, q });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, filter, onChange]);

  function addTerm(term: string): void {
    onChange(withSkill(filter, term));
  }

  return (
    <>
      <Group align="flex-end" mb="md" wrap="wrap">
        <TextInput
          flex="1 1 16rem"
          leftSection={<IconSearch size={16} />}
          placeholder="Name or email"
          aria-label="Filter by name or email"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
        <Box flex="1 1 16rem">
          <SkillPicker
            id="employee-filter-skill"
            placeholder="Skill, alias or wildcard (e.g. c*)"
            aria-label="Add a skill to the search"
            allowFreeText
            minLength={1}
            onSkillSelected={(skill) => addTerm(skill.name)}
            onTermEntered={addTerm}
          />
        </Box>
        <Select
          aria-label="Minimum level"
          data={levelOptions}
          value={String(filter.minLevel ?? 0)}
          allowDeselect={false}
          onChange={(value) =>
            onChange({ ...filter, minLevel: Number(value) || null })
          }
        />
      </Group>

      {filter.skills.length > 0 && (
        <Group mb="md" wrap="wrap">
          <Group
            component="ul"
            gap="xs"
            m={0}
            p={0}
            style={{ listStyle: "none" }}
            aria-label="Skills in the search"
          >
            {filter.skills.map((skill) => (
              <li key={skill}>
                <Pill
                  size="md"
                  withRemoveButton
                  removeButtonProps={{
                    "aria-label": `Remove ${skill} from the search`,
                    // Mantine hides this button from screen readers and the Tab key by default
                    "aria-hidden": false,
                    tabIndex: 0,
                  }}
                  onRemove={() => onChange(withoutSkill(filter, skill))}
                >
                  {skill}
                </Pill>
              </li>
            ))}
          </Group>

          {filter.skills.length > 1 && (
            <SegmentedControl
              aria-label="Combine skills with"
              data={skillMatchOptions}
              value={filter.skillMatch}
              onChange={(value) =>
                onChange({
                  ...filter,
                  skillMatch: value as ActiveFilter["skillMatch"],
                })
              }
            />
          )}
        </Group>
      )}
    </>
  );
}
