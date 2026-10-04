import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ModalRef } from '@siemens/element-ng/modal';
import { Employee, Skill } from '../api/models';
import { SkillPicker } from '../skills/skill-picker';
import { SKILLS_SAVED, SkillsDialog } from './skills-dialog';

const employee: Employee = {
  id: 'e1',
  firstname: 'Max',
  lastname: 'Muster',
  email: 'max.muster@example.com',
  age: 34,
  skills: [
    { skill_id: 's1', name: 'Python', alias: 'py', proficiency_level: 5, matched: false },
    { skill_id: 's2', name: 'Docker', alias: null, proficiency_level: 2, matched: false },
  ],
};
const kubernetes: Skill = { id: 's3', name: 'Kubernetes', alias: 'K8s', description: null };

describe('SkillsDialog', () => {
  let fixture: ComponentFixture<SkillsDialog>;
  let element: HTMLElement;
  let http: HttpTestingController;
  let modalRef: { hide: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    modalRef = { hide: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ModalRef, useValue: modalRef },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SkillsDialog);
    fixture.componentRef.setInput('employee', employee);
    element = fixture.nativeElement;
    await fixture.whenStable();
    // the skill picker may look up the catalog as soon as it is rendered
    http
      .match((req) => req.url === '/api/skills')
      .filter((req) => !req.cancelled)
      .forEach((req) => req.flush([]));
  });

  afterEach(() => http.verify());

  function rows(): HTMLElement[] {
    return Array.from(element.querySelectorAll<HTMLElement>('li'));
  }

  function levelSelect(label: string): HTMLSelectElement {
    return element.querySelector<HTMLSelectElement>(`select[aria-label="Level of ${label}"]`)!;
  }

  async function chooseLevel(label: string, level: number): Promise<void> {
    const select = levelSelect(label);
    select.value = String(level);
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
  }

  async function pick(skill: Skill): Promise<void> {
    const picker = fixture.debugElement.query(By.directive(SkillPicker))
      .componentInstance as SkillPicker;
    picker.skillSelected.emit(skill);
    await fixture.whenStable();
  }

  function button(text: string): HTMLButtonElement {
    return Array.from(element.querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.trim() === text,
    )!;
  }

  it('names the employee and lists the current skills with their levels', () => {
    expect(element.querySelector('.modal-title')?.textContent).toContain('Skills of Max Muster');
    expect(rows().map((row) => row.querySelector('span')?.textContent)).toEqual([
      'Python (py)',
      'Docker',
    ]);
    expect(levelSelect('Python (py)').value).toBe('5');
    expect(levelSelect('Docker').value).toBe('2');
  });

  it('saves level changes, removals and additions as one full state', async () => {
    await chooseLevel('Python (py)', 4);
    element.querySelector<HTMLButtonElement>('button[aria-label="Remove Docker"]')!.click();
    await pick(kubernetes);
    await chooseLevel('Kubernetes (K8s)', 3);

    button('Save').click();

    const req = http.expectOne('/api/employees/e1/skills');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      skills: [
        { skill_id: 's1', proficiency_level: 4 },
        { skill_id: 's3', proficiency_level: 3 },
      ],
    });
    req.flush({ ...employee, skills: [] });
    expect(modalRef.hide).toHaveBeenCalledWith(SKILLS_SAVED);
  });

  it('sends an empty list when every skill was removed', async () => {
    element.querySelector<HTMLButtonElement>('button[aria-label="Remove Python (py)"]')!.click();
    element.querySelector<HTMLButtonElement>('button[aria-label="Remove Docker"]')!.click();
    await fixture.whenStable();

    expect(element.textContent).toContain('No skills assigned yet.');
    button('Save').click();

    const req = http.expectOne('/api/employees/e1/skills');
    expect(req.request.body).toEqual({ skills: [] });
    req.flush({ ...employee, skills: [] });
  });

  it('blocks saving until a newly added skill has a level', async () => {
    await pick(kubernetes);

    expect(levelSelect('Kubernetes (K8s)').value).toBe('');
    expect(button('Save').disabled).toBe(true);

    await chooseLevel('Kubernetes (K8s)', 1);
    expect(button('Save').disabled).toBe(false);
  });

  it('keeps assigned skills out of the picker and ignores a skill added twice', async () => {
    await pick(kubernetes);
    await pick(kubernetes);

    expect(rows()).toHaveLength(3);
    const picker = fixture.debugElement.query(By.directive(SkillPicker))
      .componentInstance as SkillPicker;
    expect(picker.excludedSkillIds()).toEqual(['s1', 's2', 's3']);
  });

  it('shows the reason from the backend and stays open when a skill no longer exists', async () => {
    button('Save').click();
    http
      .expectOne('/api/employees/e1/skills')
      .flush({ detail: 'Skills not found: s2' }, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();

    const notification = element.querySelector('si-inline-notification');
    expect(notification?.textContent).toContain('Skills could not be saved');
    expect(notification?.textContent).toContain('Skills not found: s2');
    expect(modalRef.hide).not.toHaveBeenCalled();
    expect(button('Save').disabled).toBe(false);
  });

  it('shows a generic message when the server fails', async () => {
    button('Save').click();
    http
      .expectOne('/api/employees/e1/skills')
      .flush('boom', { status: 500, statusText: 'Internal Server Error' });
    await fixture.whenStable();

    expect(element.querySelector('si-inline-notification')?.textContent).toContain(
      'The server did not answer as expected',
    );
    expect(modalRef.hide).not.toHaveBeenCalled();
  });

  it('closes without a request on cancel', async () => {
    await chooseLevel('Python (py)', 1);

    button('Cancel').click();

    http.expectNone('/api/employees/e1/skills');
    expect(modalRef.hide).toHaveBeenCalledWith();
  });
});
