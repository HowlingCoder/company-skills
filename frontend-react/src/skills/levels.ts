export interface ProficiencyLevel {
  value: number;
  name: string;
  label: string;
}

export const PROFICIENCY_LEVELS: ProficiencyLevel[] = [
  { value: 1, name: "Beginner", label: "1 - Beginner" },
  { value: 2, name: "Basic", label: "2 - Basic" },
  { value: 3, name: "Intermediate", label: "3 - Intermediate" },
  { value: 4, name: "Advanced", label: "4 - Advanced" },
  { value: 5, name: "Expert", label: "5 - Expert" },
];

/** Name with the alias in brackets, e.g. "Kubernetes (K8s)". */
export function skillLabel(skill: {
  name: string;
  alias: string | null;
}): string {
  return skill.alias ? `${skill.name} (${skill.alias})` : skill.name;
}
