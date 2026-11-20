import { Badge, VisuallyHidden } from "@mantine/core";
import type { CSSProperties } from "react";
import type { EmployeeSkill } from "../api/models";
import { skillHue } from "../skills/skill-hue";
import "./skill-badges.css";

interface SkillBadgeProps {
  skill: EmployeeSkill;
  /** Outlined instead of filled: another skill of the row matches the search. */
  unmatched?: boolean;
}

/**
 * One badge: hue from the skill name, color strength from the level (skill-badges.css).
 * The level is printed as a number too, so color is never the only carrier of information.
 */
export function SkillBadge({ skill, unmatched = false }: SkillBadgeProps) {
  const classes = [
    "skill-badge",
    `skill-level-${skill.proficiency_level}`,
    skill.matched ? "skill-matched" : "",
    unmatched ? "skill-unmatched" : "",
  ];

  return (
    <Badge
      className={classes.filter(Boolean).join(" ")}
      style={{ "--skill-hue": skillHue(skill.name) } as CSSProperties}
      tt="none"
      size="lg"
      radius="sm"
    >
      {skill.name} {skill.proficiency_level}
      {skill.matched && <VisuallyHidden> (matches the search)</VisuallyHidden>}
    </Badge>
  );
}
