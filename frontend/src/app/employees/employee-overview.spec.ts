import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideSiDatatableConfig } from '@siemens/element-ng/datatable';
import { Employee } from '../api/models';
import { EmployeeOverview } from './employee-overview';

const employees: Employee[] = [
  {
    id: '1',
    firstname: 'Max',
    lastname: 'Muster',
    email: 'max.muster@example.com',
    age: 34,
    skills: [
      { skill_id: 's1', name: 'Python', alias: 'py', proficiency_level: 5, matched: false },
      { skill_id: 's2', name: 'Docker', alias: null, proficiency_level: 2, matched: false },
    ],
  },
  {
    id: '2',
    firstname: 'Anna',
    lastname: 'Schmidt',
    email: 'anna.schmidt@example.com',
    age: 29,
    skills: [],
  },
];

describe('EmployeeOverview', () => {
  let fixture: ComponentFixture<EmployeeOverview>;
  let element: HTMLElement;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideSiDatatableConfig()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(EmployeeOverview);
    element = fixture.nativeElement;
  });

  afterEach(() => http.verify());

  async function respond(body: Employee[]): Promise<void> {
    http.expectOne('/api/employees').flush(body);
    await fixture.whenStable();
  }

  it('shows a spinner while the employees are loading', async () => {
    await fixture.whenStable();

    expect(element.querySelector('si-loading-spinner')).not.toBeNull();
    expect(element.querySelector('ngx-datatable')).toBeNull();

    await respond([]);
    expect(element.querySelector('si-loading-spinner')).toBeNull();
  });

  it('lists every employee with name, email, age and skill badges', async () => {
    await respond(employees);

    const rows = Array.from(element.querySelectorAll('datatable-body-row'));
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Max Muster');
    expect(rows[0].textContent).toContain('max.muster@example.com');
    expect(rows[0].textContent).toContain('34');
    const badges = Array.from(rows[0].querySelectorAll('.skill-badge')).map((badge) =>
      badge.textContent?.trim(),
    );
    expect(badges).toEqual(['Python 5', 'Docker 2']);
    expect(rows[1].textContent).toContain('Anna Schmidt');
    expect(rows[1].querySelectorAll('.skill-badge')).toHaveLength(0);
  });

  it('shows the empty state instead of the table when there are no employees', async () => {
    await respond([]);

    expect(element.querySelector('ngx-datatable')).toBeNull();
    expect(element.querySelector('si-empty-state')?.textContent).toContain('No employees yet');
  });

  it('shows an error with a retry action when loading fails, and reloads on retry', async () => {
    http
      .expectOne('/api/employees')
      .flush('boom', { status: 500, statusText: 'Internal Server Error' });
    await fixture.whenStable();

    const notification = element.querySelector('si-inline-notification');
    expect(notification?.textContent).toContain('Employees could not be loaded');
    expect(element.querySelector('ngx-datatable')).toBeNull();

    const retry = Array.from(notification!.querySelectorAll<HTMLElement>('a, button')).find(
      (candidate) => candidate.textContent?.includes('Retry'),
    );
    expect(retry).toBeDefined();
    retry!.click();
    await respond(employees);

    expect(element.querySelector('si-inline-notification')).toBeNull();
    expect(element.querySelectorAll('datatable-body-row')).toHaveLength(2);
  });
});
