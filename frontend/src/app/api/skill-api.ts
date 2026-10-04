import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Skill } from './models';

@Injectable({ providedIn: 'root' })
export class SkillApi {
  private readonly http = inject(HttpClient);

  list(q = ''): Observable<Skill[]> {
    let params = new HttpParams();
    const term = q.trim();
    if (term) {
      params = params.set('q', term);
    }
    return this.http.get<Skill[]>('/api/skills', { params });
  }
}
