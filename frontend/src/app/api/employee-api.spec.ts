import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { EmployeeApi } from './employee-api';
import { Employee } from './models';

describe('EmployeeApi', () => {
  let api: EmployeeApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(EmployeeApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('requests all employees without query params when no filter is given', () => {
    const employees: Employee[] = [
      {
        id: '7b0c1f0e-0000-4000-8000-000000000001',
        firstname: 'Max',
        lastname: 'Muster',
        email: 'max.muster@example.com',
        age: 34,
        skills: [
          {
            skill_id: '7b0c1f0e-0000-4000-8000-000000000002',
            name: 'Kubernetes',
            alias: 'K8s',
            proficiency_level: 4,
            matched: false,
          },
        ],
      },
    ];
    let result: Employee[] | undefined;

    api.list().subscribe((value) => (result = value));

    const req = http.expectOne('/api/employees');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush(employees);
    expect(result).toEqual(employees);
  });

  it('sends every skill term as a repeated skills param', () => {
    api.list({ skills: ['Python', 'K8s'], skillMatch: 'or', minLevel: 3 }).subscribe();

    const req = http.expectOne((r) => r.url === '/api/employees');
    expect(req.request.params.getAll('skills')).toEqual(['Python', 'K8s']);
    expect(req.request.params.get('skill_match')).toBe('or');
    expect(req.request.params.get('min_level')).toBe('3');
    expect(req.request.urlWithParams).toBe(
      '/api/employees?skills=Python&skills=K8s&skill_match=or&min_level=3',
    );
    req.flush([]);
  });

  it('omits blank filter values instead of sending empty params', () => {
    api.list({ q: '   ', skills: ['', '  '], skillMatch: 'or' }).subscribe();

    const req = http.expectOne((r) => r.url === '/api/employees');
    expect(req.request.params.keys()).toEqual([]);
    req.flush([]);
  });

  it('trims the free text filter', () => {
    api.list({ q: ' max muster ' }).subscribe();

    const req = http.expectOne((r) => r.url === '/api/employees');
    expect(req.request.params.get('q')).toBe('max muster');
    req.flush([]);
  });

  it('sends the full skill state of one employee with PUT', () => {
    const skills = [
      { skill_id: 's1', proficiency_level: 4 },
      { skill_id: 's2', proficiency_level: 1 },
    ];

    api.setSkills('e1', skills).subscribe();

    const req = http.expectOne('/api/employees/e1/skills');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ skills });
    req.flush({});
  });

  it('passes a server error on to the caller', () => {
    let status: number | undefined;

    api.list().subscribe({ error: (error) => (status = error.status) });

    http
      .expectOne('/api/employees')
      .flush('boom', { status: 500, statusText: 'Internal Server Error' });
    expect(status).toBe(500);
  });
});
