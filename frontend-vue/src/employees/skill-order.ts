import { type EmployeeSkill } from '@/api/models'

/** Badges shown directly in the table cell; the rest moves into the popover. */
export const MAX_VISIBLE_SKILLS = 4

export interface SkillSplit {
  visible: EmployeeSkill[]
  overflow: EmployeeSkill[]
  /** With a match in the list, the other skills step back so the matches stand out. */
  hasMatches: boolean
}

/**
 * Splits the skills (sorted by level by the backend) into badges and popover. Skills that
 * match the active search come first, so a match is never hidden in the popover.
 */
export function splitSkills(skills: EmployeeSkill[], max = MAX_VISIBLE_SKILLS): SkillSplit {
  const ordered = [...skills.filter((s) => s.matched), ...skills.filter((s) => !s.matched)]
  return {
    visible: ordered.slice(0, max),
    overflow: ordered.slice(max),
    hasMatches: skills.some((s) => s.matched),
  }
}

/** Accessible name of the +N button. */
export function overflowLabel(count: number): string {
  return `Show ${count} more ${count === 1 ? 'skill' : 'skills'}`
}
