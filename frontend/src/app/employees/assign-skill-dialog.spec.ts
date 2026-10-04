import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ModalRef } from '@siemens/element-ng/modal';
import { SiToastNotificationService } from '@siemens/element-ng/toast-notification';
import { Employee, Skill } from '../api/models';
import { SkillPicker } from '../skills/skill-picker';
import { AssignSkillDialog, SKILL_ASSIGNED } from './assign-skill-dialog';

const python: Skill = { id: 's1', name: 'Python', alias: 'py', description: null };
const docker: Skill = { id: 's2', name: 'Docker', alias: null, description: null };

function employee(id: string, firstname: string, lastname: string, pythonLevel?: number): Employee {
  return {
    id,
    firstname,
    lastname,
    email: `${firstname.toLowerCase()}@example.com`,
    age: 30,
    skills: pythonLevel
      ? [
          {
            skill_id: 's1',
            name: 'Python',
            alias: 'py',
            proficiency_level: pythonLevel,
            matched: false,
          },
        ]
      : [],
  };
}

const employees = [
  employee('e1', 'Max', 'Muster', 4),
  employee('e2', 'Anna', 'Schmidt'),
  employee('e3', 'Emre', 'Yilmaz', 2),
];

describe('AssignSkillDialog', () => {
  let fixture: ComponentFixture<AssignSkillDialog>;
  let element: HTMLElement;
  let http: HttpTestingController;
  let modalRef: { hide: ReturnType<typeof vi.fn> };
  let queueToast: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    modalRef = { hide: vi.fn() };
    queueToast = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ModalRef, useValue: modalRef },
        { provide: SiToastNotificationService, useValue: { queueToastNotification: queueToast } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AssignSkillDialog);
    fixture.componentRef.setInput('employees', employees);
    element = fixture.nativeElement;
    await fixture.whenStable();
    flushCatalogLookups();
  });

  afterEach(() => {
    flushCatalogLookups();
    http.verify();
  });

  /** The skill picker may look up the catalog as soon as it is rendered. */
  function flushCatalogLookups(): void {
    http
      .match((req) => req.url === '/api/skills')
      .filter((req) => !req.cancelled)
      .forEach((req) => req.flush([]));
  }

  async function pick(skill: Skill): Promise<void> {
    const picker = fixture.debugElement.query(By.directive(SkillPicker))
      .componentInstance as SkillPicker;
    picker.skillSelected.emit(skill);
    await fixture.whenStable();
  }

  async function chooseLevel(level: number): Promise<void> {
    const select = element.querySelector<HTMLSelectElement>('#assign-skill-level')!;
    select.value = String(level);
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
  }

  function buttons(): string[] {
    return Array.from(element.querySelectorAll('.modal-footer button')).map(
      (button) => button.textContent?.trim() ?? '',
    );
  }

  function button(text: string): HTMLButtonElement {
    return Array.from(element.querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.trim() === text,
    )!;
  }

  function conflictRows(): string[] {
    return Array.from(
      element.querySelectorAll('ul[aria-label="Employees who already have this skill"] li'),
    ).map((row) => row.textContent?.trim() ?? '');
  }

  it('lists the selected employees', () => {
    expect(element.textContent).toContain('Selected employees (3)');
    const names = Array.from(
      element.querySelectorAll('ul[aria-labelledby="assign-skill-employees"] li'),
    ).map((row) => row.textContent?.trim());
    expect(names).toEqual(['Max Muster', 'Anna Schmidt', 'Emre Yilmaz']);
  });

  it('links the labels to the skill and the level field', () => {
    const labels = Array.from(element.querySelectorAll('label'));
    const skillLabel = labels.find((label) => label.textContent?.trim() === 'Skill');
    const levelLabel = labels.find((label) => label.textContent?.trim() === 'Level');

    expect(element.querySelector(`#${skillLabel?.htmlFor}`)?.tagName).toBe('INPUT');
    expect(element.querySelector(`#${levelLabel?.htmlFor}`)?.tagName).toBe('SELECT');
  });

  it('blocks assigning until a skill and a level are chosen', async () => {
    expect(button('Assign').disabled).toBe(true);

    await pick(docker);
    expect(button('Assign').disabled).toBe(true);

    await chooseLevel(3);
    expect(button('Assign').disabled).toBe(false);
  });

  it('offers a single Assign button without conflicts and sends all employees', async () => {
    await pick(docker);
    await chooseLevel(3);

    expect(buttons()).toEqual(['Cancel', 'Assign']);
    expect(conflictRows()).toEqual([]);
    button('Assign').click();

    const req = http.expectOne('/api/skill-assignments/bulk');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      employee_ids: ['e1', 'e2', 'e3'],
      skill_id: 's2',
      proficiency_level: 3,
    });
    expect(req.request.params.keys()).toEqual([]);
    req.flush({ created: ['e1', 'e2', 'e3'], updated: [], skipped: [] });

    expect(queueToast).toHaveBeenCalledWith(
      'success',
      'Docker assigned',
      '3 assigned, 0 updated, 0 skipped.',
    );
    expect(modalRef.hide).toHaveBeenCalledWith(SKILL_ASSIGNED);
  });

  it('shows who already has the skill and with which level', async () => {
    await pick(python);

    expect(element.querySelector('si-inline-notification')?.textContent).toContain(
      '2 of the selected employees already have this skill',
    );
    expect(conflictRows()).toEqual(['Max Muster: level 4', 'Emre Yilmaz: level 2']);
    expect(buttons()).toEqual(['Cancel', 'Overwrite levels', 'Keep existing levels']);
  });

  it('words the warning for a single employee who already has the skill', async () => {
    fixture.componentRef.setInput('employees', [employees[0], employees[1]]);
    await pick(python);

    expect(element.querySelector('si-inline-notification')?.textContent).toContain(
      '1 of the selected employees already has this skill',
    );
    expect(conflictRows()).toEqual(['Max Muster: level 4']);
  });

  it('keeps existing levels by default: no on_conflict is sent', async () => {
    await pick(python);
    await chooseLevel(5);

    button('Keep existing levels').click();

    const req = http.expectOne((r) => r.url === '/api/skill-assignments/bulk');
    expect(req.request.params.keys()).toEqual([]);
    req.flush({ created: ['e2'], updated: [], skipped: ['e1', 'e3'] });
    expect(queueToast).toHaveBeenCalledWith(
      'success',
      'Python assigned',
      '1 assigned, 0 updated, 2 skipped.',
    );
  });

  it('overwrites existing levels only when asked explicitly', async () => {
    await pick(python);
    await chooseLevel(5);

    button('Overwrite levels').click();

    const req = http.expectOne((r) => r.url === '/api/skill-assignments/bulk');
    expect(req.request.params.get('on_conflict')).toBe('overwrite');
    req.flush({ created: ['e2'], updated: ['e1', 'e3'], skipped: [] });
    expect(queueToast).toHaveBeenCalledWith(
      'success',
      'Python assigned',
      '1 assigned, 2 updated, 0 skipped.',
    );
  });

  it('reports what the backend did, even if nothing changed', async () => {
    await pick(python);
    await chooseLevel(5);

    button('Keep existing levels').click();
    http
      .expectOne((r) => r.url === '/api/skill-assignments/bulk')
      .flush({ created: [], updated: [], skipped: ['e1', 'e2', 'e3'] });

    expect(queueToast).toHaveBeenCalledWith(
      'info',
      'Nothing changed',
      '0 assigned, 0 updated, 3 skipped.',
    );
  });

  it('lets the user change the chosen skill', async () => {
    await pick(python);
    expect(conflictRows()).toHaveLength(2);

    button('Change').click();
    await fixture.whenStable();

    expect(fixture.debugElement.query(By.directive(SkillPicker))).not.toBeNull();
    expect(conflictRows()).toEqual([]);
  });

  it('shows the reason from the backend and stays open when an employee no longer exists', async () => {
    await pick(docker);
    await chooseLevel(3);

    button('Assign').click();
    http
      .expectOne('/api/skill-assignments/bulk')
      .flush({ detail: 'Employees not found: e2' }, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();

    const notification = element.querySelector('si-inline-notification');
    expect(notification?.textContent).toContain('Skill could not be assigned');
    expect(notification?.textContent).toContain('Employees not found: e2');
    expect(queueToast).not.toHaveBeenCalled();
    expect(modalRef.hide).not.toHaveBeenCalled();
    expect(button('Assign').disabled).toBe(false);
  });

  it('shows a generic message when the server fails', async () => {
    await pick(docker);
    await chooseLevel(3);

    button('Assign').click();
    http
      .expectOne('/api/skill-assignments/bulk')
      .flush('boom', { status: 500, statusText: 'Internal Server Error' });
    await fixture.whenStable();

    expect(element.querySelector('si-inline-notification')?.textContent).toContain(
      'The server did not answer as expected',
    );
    expect(modalRef.hide).not.toHaveBeenCalled();
  });
});
