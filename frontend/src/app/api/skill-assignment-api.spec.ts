import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { BulkAssignment, BulkAssignmentResult } from './models';
import { SkillAssignmentApi } from './skill-assignment-api';

const assignment: BulkAssignment = {
  employee_ids: ['e1', 'e2'],
  skill_id: 's1',
  proficiency_level: 3,
};

describe('SkillAssignmentApi', () => {
  let api: SkillAssignmentApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(SkillAssignmentApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('keeps existing levels by default: no on_conflict param is sent', () => {
    const outcome: BulkAssignmentResult = { created: ['e1'], updated: [], skipped: ['e2'] };
    let result: BulkAssignmentResult | undefined;

    api.bulkAssign(assignment).subscribe((value) => (result = value));

    const req = http.expectOne('/api/skill-assignments/bulk');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(assignment);
    expect(req.request.params.keys()).toEqual([]);
    req.flush(outcome);
    expect(result).toEqual(outcome);
  });

  it('asks for overwrite explicitly', () => {
    api.bulkAssign(assignment, true).subscribe();

    const req = http.expectOne((r) => r.url === '/api/skill-assignments/bulk');
    expect(req.request.urlWithParams).toBe('/api/skill-assignments/bulk?on_conflict=overwrite');
    req.flush({ created: [], updated: ['e1', 'e2'], skipped: [] });
  });
});
