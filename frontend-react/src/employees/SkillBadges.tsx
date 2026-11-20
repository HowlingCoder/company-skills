import { Button, Group, Popover } from "@mantine/core";
import type { EmployeeSkill } from "../api/models";
import { SkillBadge } from "./SkillBadge";
import { overflowLabel, splitSkills } from "./skill-order";

interface SkillBadgesProps {
  /** Skills as delivered by the backend: sorted by level, highest first. */
  skills: EmployeeSkill[];
}

/** The first skills as badges, the rest behind a +N button in a popover. */
export function SkillBadges({ skills }: SkillBadgesProps) {
  const { visible, overflow, hasMatches } = splitSkills(skills);

  return (
    <Group gap="xs" wrap="nowrap">
      {visible.map((skill) => (
        <SkillBadge
          key={skill.skill_id}
          skill={skill}
          unmatched={hasMatches && !skill.matched}
        />
      ))}
      {overflow.length > 0 && (
        <Popover position="bottom" withArrow shadow="md">
          <Popover.Target>
            <Button
              className="skill-overflow"
              size="compact-sm"
              radius="xl"
              variant="default"
              aria-label={overflowLabel(overflow.length)}
            >
              +{overflow.length}
            </Button>
          </Popover.Target>
          <Popover.Dropdown>
            <Group gap="xs" maw="20rem">
              {overflow.map((skill) => (
                <SkillBadge
                  key={skill.skill_id}
                  skill={skill}
                  unmatched={hasMatches && !skill.matched}
                />
              ))}
            </Group>
          </Popover.Dropdown>
        </Popover>
      )}
    </Group>
  );
}
