import { request } from './http'
import { type Employee, type EmployeeFilter, type ImportReport, type SkillLevel } from './models'

export async function listEmployees(filter: EmployeeFilter = {}): Promise<Employee[]> {
  const params = new URLSearchParams()
  const q = filter.q?.trim()
  if (q) {
    params.set('q', q)
  }
  const skills = (filter.skills ?? []).map((term) => term.trim()).filter(Boolean)
  for (const term of skills) {
    params.append('skills', term)
  }
  // skill_match only has an effect together with skills
  if (skills.length && filter.skillMatch) {
    params.set('skill_match', filter.skillMatch)
  }
  if (filter.minLevel != null) {
    params.set('min_level', `${filter.minLevel}`)
  }

  const apiParams = params.size > 0 ? '?' + params.toString() : ''
  return request<Employee[]>('/api/employees' + apiParams)
}

/** Sets the full skill state: skills missing in the list are removed. */
export async function setSkills(employeeId: string, skills: SkillLevel[]): Promise<Employee> {
  return request<Employee>(`/api/employees/${employeeId}/skills`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skills }),
  })
}

/** Uploads a CSV file; rows with errors are reported, the others are imported. */
export async function importEmployees(file: File): Promise<ImportReport> {
  const body = new FormData()
  body.append('file', file)
  return request<ImportReport>('/api/employees/import', { method: 'POST', body })
}
