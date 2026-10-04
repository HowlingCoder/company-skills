// Mirrors the response schemas of the backend (SkillRead, EmployeeSkillRead, EmployeeRead).

export interface Skill {
  id: string;
  name: string;
  alias: string | null;
  description: string | null;
}

export interface EmployeeSkill {
  skill_id: string;
  name: string;
  alias: string | null;
  proficiency_level: number;
  matched: boolean;
}

export interface Employee {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  age: number;
  skills: EmployeeSkill[];
}

export interface EmployeeFilter {
  q?: string;
  skills?: string[];
  skillMatch?: 'and' | 'or';
  minLevel?: number;
}
