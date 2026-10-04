import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BulkAssignment, BulkAssignmentResult } from './models';

@Injectable({ providedIn: 'root' })
export class SkillAssignmentApi {
  private readonly http = inject(HttpClient);

  /** Assigns one skill to many employees; existing levels are kept unless overwrite is set. */
  bulkAssign(assignment: BulkAssignment, overwrite = false): Observable<BulkAssignmentResult> {
    let params = new HttpParams();
    if (overwrite) {
      params = params.set('on_conflict', 'overwrite');
    }
    return this.http.post<BulkAssignmentResult>('/api/skill-assignments/bulk', assignment, {
      params,
    });
  }
}
