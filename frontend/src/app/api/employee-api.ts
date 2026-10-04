import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Employee, EmployeeFilter, SkillLevel } from './models';

@Injectable({ providedIn: 'root' })
export class EmployeeApi {
  private readonly http = inject(HttpClient);

  list(filter: EmployeeFilter = {}): Observable<Employee[]> {
    let params = new HttpParams();
    const q = filter.q?.trim();
    if (q) {
      params = params.set('q', q);
    }
    const skills = (filter.skills ?? []).map((term) => term.trim()).filter(Boolean);
    for (const term of skills) {
      params = params.append('skills', term);
    }
    // skill_match only has an effect together with skills
    if (skills.length && filter.skillMatch) {
      params = params.set('skill_match', filter.skillMatch);
    }
    if (filter.minLevel != null) {
      params = params.set('min_level', filter.minLevel);
    }
    return this.http.get<Employee[]>('/api/employees', { params });
  }

  /** Sets the full skill state: skills missing in the list are removed. */
  setSkills(employeeId: string, skills: SkillLevel[]): Observable<Employee> {
    return this.http.put<Employee>(`/api/employees/${employeeId}/skills`, { skills });
  }
}
