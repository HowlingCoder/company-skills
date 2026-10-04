export interface ProficiencyLevel {
  value: number;
  label: string;
}

export const PROFICIENCY_LEVELS: ProficiencyLevel[] = [
  { value: 1, label: '1 - Beginner' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 5, label: '5 - Expert' },
];

/** Name with the alias in brackets, e.g. "Kubernetes (K8s)". */
export function skillLabel(skill: { name: string; alias: string | null }): string {
  return skill.alias ? `${skill.name} (${skill.alias})` : skill.name;
}
