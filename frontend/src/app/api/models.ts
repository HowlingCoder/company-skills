// Mirrors the response schemas of the backend (SkillRead, EmployeeSkillRead, EmployeeRead,
// ImportReport).

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

export interface ImportedEmployee {
  lastname: string;
  firstname: string;
  email: string;
  age: number;
}

export interface RowError {
  line: number;
  message: string;
}

export interface ImportReport {
  imported_count: number;
  failed_count: number;
  imported: ImportedEmployee[];
  errors: RowError[];
}
