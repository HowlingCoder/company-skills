import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Skill } from './models';
import { SkillApi } from './skill-api';

describe('SkillApi', () => {
  let api: SkillApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(SkillApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('requests the whole catalog when no search term is given', () => {
    const skills: Skill[] = [
      {
        id: '7b0c1f0e-0000-4000-8000-000000000002',
        name: 'Kubernetes',
        alias: 'K8s',
        description: null,
      },
    ];
    let result: Skill[] | undefined;

    api.list().subscribe((value) => (result = value));

    const req = http.expectOne('/api/skills');
    expect(req.request.method).toBe('GET');
    req.flush(skills);
    expect(result).toEqual(skills);
  });

  it('sends the trimmed search term as q', () => {
    api.list(' py ').subscribe();

    const req = http.expectOne((r) => r.url === '/api/skills');
    expect(req.request.urlWithParams).toBe('/api/skills?q=py');
    req.flush([]);
  });
});
