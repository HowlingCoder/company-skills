import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideSiDatatableConfig } from '@siemens/element-ng/datatable';
import { SiModalService } from '@siemens/element-ng/modal';
import { Subject } from 'rxjs';
import { Employee } from '../api/models';
import { EmployeeOverview } from './employee-overview';
import { EMPLOYEES_IMPORTED, ImportDialog } from './import-dialog';
import { SKILLS_SAVED, SkillsDialog } from './skills-dialog';

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

  function importButtons(): HTMLButtonElement[] {
    return Array.from(element.querySelectorAll('button')).filter(
      (button) => button.textContent?.trim() === 'Import CSV',
    );
  }

  it('opens the import dialog from the button above the table', async () => {
    const show = vi
      .spyOn(TestBed.inject(SiModalService), 'show')
      .mockReturnValue({ message: new Subject() } as never);
    await respond(employees);

    importButtons()[0].click();

    expect(show).toHaveBeenCalledWith(ImportDialog, expect.anything());
  });

  it('lets the user leave the import dialog with Escape or a click outside', async () => {
    const show = vi
      .spyOn(TestBed.inject(SiModalService), 'show')
      .mockReturnValue({ message: new Subject() } as never);
    await respond(employees);

    importButtons()[0].click();

    expect(show).toHaveBeenCalledWith(
      ImportDialog,
      expect.objectContaining({ keyboard: true, ignoreBackdropClick: false }),
    );
  });

  it('offers the import in the empty state too', async () => {
    const show = vi
      .spyOn(TestBed.inject(SiModalService), 'show')
      .mockReturnValue({ message: new Subject() } as never);
    await respond([]);

    const emptyStateButton = element.querySelector<HTMLButtonElement>('si-empty-state button');
    expect(emptyStateButton?.textContent?.trim()).toBe('Import CSV');
    emptyStateButton!.click();

    expect(show).toHaveBeenCalledWith(ImportDialog, expect.anything());
  });

  function manageSkillsButton(name: string): HTMLButtonElement {
    return element.querySelector<HTMLButtonElement>(
      `button[aria-label="Manage skills of ${name}"]`,
    )!;
  }

  it('opens the skills dialog for the employee of the clicked row', async () => {
    const show = vi
      .spyOn(TestBed.inject(SiModalService), 'show')
      .mockReturnValue({ hidden: new Subject() } as never);
    await respond(employees);

    manageSkillsButton('Anna Schmidt').click();

    expect(show).toHaveBeenCalledWith(
      SkillsDialog,
      expect.objectContaining({
        inputValues: { employee: expect.objectContaining({ id: '2', firstname: 'Anna' }) },
      }),
    );
  });

  it('reloads the table after skills were saved, but not after cancel', async () => {
    // every opened dialog has its own close notification
    const closed: Subject<string | undefined>[] = [];
    vi.spyOn(TestBed.inject(SiModalService), 'show').mockImplementation(() => {
      closed.push(new Subject());
      return { hidden: closed[closed.length - 1] } as never;
    });
    await respond(employees);

    manageSkillsButton('Max Muster').click();
    closed[0].next(undefined);
    http.expectNone('/api/employees');

    manageSkillsButton('Max Muster').click();
    closed[1].next(SKILLS_SAVED);
    await respond(employees);
  });

  it('reloads the table when the dialog reports an import', async () => {
    const message = new Subject<string>();
    vi.spyOn(TestBed.inject(SiModalService), 'show').mockReturnValue({ message } as never);
    await respond([]);
    importButtons()[0].click();

    message.next(EMPLOYEES_IMPORTED);
    await respond(employees);

    expect(element.querySelectorAll('datatable-body-row')).toHaveLength(2);
  });
});
