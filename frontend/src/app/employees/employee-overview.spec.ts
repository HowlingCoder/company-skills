import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideSiDatatableConfig } from '@siemens/element-ng/datatable';
import { SiModalService } from '@siemens/element-ng/modal';
import { Subject } from 'rxjs';
import { Employee } from '../api/models';
import { AssignSkillDialog, SKILL_ASSIGNED } from './assign-skill-dialog';
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
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideSiDatatableConfig(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(EmployeeOverview);
    element = fixture.nativeElement;
  });

  afterEach(() => {
    flushCatalogLookups();
    http.verify();
  });

  /** The skill picker of the filter bar may look up the catalog when it is rendered or used. */
  function flushCatalogLookups(): void {
    http
      .match((req) => req.url === '/api/skills')
      .filter((req) => !req.cancelled)
      .forEach((req) => req.flush([]));
  }

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

  describe('while the free-tier backend of the demo is starting', () => {
    beforeEach(() => {
      // The component starts its timers on creation: recreate it under fake timers
      vi.useFakeTimers();
      fixture.destroy();
      fixture = TestBed.createComponent(EmployeeOverview);
      element = fixture.nativeElement;
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    function hint(): string | undefined {
      return element.querySelector('[role="status"]')?.textContent?.trim();
    }

    /** The request of the destroyed first component is cancelled; only the open one counts. */
    function openRequests() {
      return http.match('/api/employees').filter((req) => !req.cancelled);
    }

    function answerWakingUp(status = 502): void {
      openRequests().forEach((req) => req.flush('', { status, statusText: 'Bad Gateway' }));
    }

    function answer(body: Employee[]): void {
      const requests = openRequests();
      expect(requests).toHaveLength(1);
      requests[0].flush(body);
    }

    it('explains the wait when the first load takes longer than 3 seconds', async () => {
      await vi.advanceTimersByTimeAsync(2_900);
      fixture.detectChanges();
      expect(hint()).toBeUndefined();

      await vi.advanceTimersByTimeAsync(200);
      fixture.detectChanges();
      expect(hint()).toContain('This can take about a minute');

      answer(employees);
      fixture.detectChanges();
      expect(hint()).toBeUndefined();
    });

    it('retries every 5 seconds on a gateway error and shows the table once the backend answers', async () => {
      answerWakingUp(502);
      await vi.advanceTimersByTimeAsync(5_000);
      answerWakingUp(503);
      await vi.advanceTimersByTimeAsync(5_000);

      answer(employees);
      fixture.detectChanges();

      expect(element.querySelector('si-inline-notification')).toBeNull();
      expect(element.querySelectorAll('datatable-body-row')).toHaveLength(2);
    });

    it('gives up after 2 minutes and shows the error with the retry action', async () => {
      for (let waited = 0; waited < 115_000; waited += 5_000) {
        answerWakingUp(504);
        await vi.advanceTimersByTimeAsync(5_000);
      }
      fixture.detectChanges();
      expect(element.querySelector('si-inline-notification')).toBeNull();
      // match() takes the requests out of the controller, so answer the ones it returned
      const stillTrying = openRequests();
      expect(stillTrying).toHaveLength(1);

      stillTrying[0].flush('', { status: 504, statusText: 'Gateway Timeout' });
      await vi.advanceTimersByTimeAsync(5_000);
      answerWakingUp(504);
      fixture.detectChanges();

      expect(openRequests()).toHaveLength(0);
      expect(element.querySelector('si-inline-notification')?.textContent).toContain(
        'Employees could not be loaded',
      );
    });
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

  function assignButton(): HTMLButtonElement {
    return Array.from(element.querySelectorAll('button')).find((button) =>
      button.textContent?.trim().startsWith('Assign skill'),
    )!;
  }

  async function tickRow(index: number): Promise<void> {
    const row = element.querySelectorAll('datatable-body-row')[index];
    row.querySelector<HTMLInputElement>('input[type=checkbox]')!.click();
    await fixture.whenStable();
  }

  it('enables "Assign skill" only with a selection and shows the number of rows', async () => {
    await respond(employees);
    expect(assignButton().disabled).toBe(true);
    expect(assignButton().textContent?.trim()).toBe('Assign skill');

    await tickRow(0);
    await tickRow(1);

    expect(assignButton().disabled).toBe(false);
    expect(assignButton().textContent?.trim()).toBe('Assign skill (2)');
  });

  it('keeps the skill dialogs open on Escape, so unsaved input is not lost', async () => {
    const show = vi
      .spyOn(TestBed.inject(SiModalService), 'show')
      .mockReturnValue({ hidden: new Subject() } as never);
    await respond(employees);

    manageSkillsButton('Max Muster').click();
    await tickRow(0);
    assignButton().click();

    // Element modals ignore Escape unless `keyboard` is set
    for (const dialog of [SkillsDialog, AssignSkillDialog]) {
      const options = show.mock.calls.find(([content]) => content === dialog)?.[1];
      expect(options).toBeDefined();
      expect(options).not.toHaveProperty('keyboard');
    }
  });

  it('tells why "Assign skill" is disabled until rows are selected', async () => {
    await respond(employees);
    expect(assignButton().title).toBe('Select employees in the table first');

    await tickRow(0);

    expect(assignButton().hasAttribute('title')).toBe(false);
  });

  it('offers "Assign skill" again after the table while rows are selected', async () => {
    const show = vi
      .spyOn(TestBed.inject(SiModalService), 'show')
      .mockReturnValue({ hidden: new Subject() } as never);
    await respond(employees);
    const assignButtons = (): HTMLButtonElement[] =>
      Array.from(element.querySelectorAll('button')).filter((button) =>
        button.textContent?.trim().startsWith('Assign skill'),
      );
    expect(assignButtons()).toHaveLength(1);

    await tickRow(1);

    expect(assignButtons()).toHaveLength(2);
    const afterTable = assignButtons()[1];
    expect(afterTable.textContent?.trim()).toBe('Assign skill (1)');
    expect(
      element.querySelector('ngx-datatable')!.compareDocumentPosition(afterTable) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    afterTable.click();
    expect(show).toHaveBeenCalledWith(
      AssignSkillDialog,
      expect.objectContaining({
        inputValues: { employees: [expect.objectContaining({ id: '2' })] },
      }),
    );
  });

  describe('sorting by name', () => {
    function nameHeader(): HTMLElement {
      return element.querySelector<HTMLElement>('datatable-header-cell[title="Name"]')!;
    }

    function names(): string[] {
      return Array.from(element.querySelectorAll('datatable-body-row')).map(
        (row) => row.querySelector('datatable-body-cell')?.textContent?.trim() ?? '',
      );
    }

    it('marks the name column as sorted from the start', async () => {
      await respond(employees);

      expect(nameHeader().getAttribute('aria-sort')).toBe('ascending');
      expect(names()).toEqual(['Max Muster', 'Anna Schmidt']);
    });

    it('sorts by last name, not by the first name shown first', async () => {
      await respond(employees);

      nameHeader().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await fixture.whenStable();

      expect(nameHeader().getAttribute('aria-sort')).toBe('descending');
      expect(names()).toEqual(['Anna Schmidt', 'Max Muster']);
    });
  });

  it('opens the assign dialog with the ticked employees', async () => {
    const show = vi
      .spyOn(TestBed.inject(SiModalService), 'show')
      .mockReturnValue({ hidden: new Subject() } as never);
    await respond(employees);
    await tickRow(1);

    assignButton().click();

    expect(show).toHaveBeenCalledWith(
      AssignSkillDialog,
      expect.objectContaining({
        inputValues: { employees: [expect.objectContaining({ id: '2', firstname: 'Anna' })] },
      }),
    );
  });

  it('reloads the table and clears the selection after a skill was assigned', async () => {
    const hidden = new Subject<string | undefined>();
    vi.spyOn(TestBed.inject(SiModalService), 'show').mockReturnValue({ hidden } as never);
    await respond(employees);
    await tickRow(0);
    assignButton().click();

    hidden.next(SKILL_ASSIGNED);
    await respond(employees);

    expect(assignButton().disabled).toBe(true);
    expect(
      element.querySelectorAll('datatable-body-row input[type=checkbox]:checked'),
    ).toHaveLength(0);
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
  describe('search', () => {
    const matching: Employee[] = [
      {
        ...employees[0],
        skills: [
          { skill_id: 's1', name: 'Python', alias: 'py', proficiency_level: 5, matched: true },
          { skill_id: 's2', name: 'Docker', alias: null, proficiency_level: 2, matched: false },
        ],
      },
    ];

    /** Answers the pending employee request and returns its query string. */
    async function respondToSearch(body: Employee[]): Promise<string> {
      // requests of searches that a newer one replaced are cancelled
      const pending = http
        .match((r) => r.url === '/api/employees')
        .filter((candidate) => !candidate.cancelled);
      expect(pending).toHaveLength(1);
      pending[0].flush(body);
      await fixture.whenStable();
      return pending[0].request.params.toString();
    }

    async function openWith(url: string): Promise<void> {
      await TestBed.inject(Router).navigateByUrl(url);
      await fixture.whenStable();
    }

    function currentUrl(): string {
      return TestBed.inject(Router).url;
    }

    function pills(): string[] {
      return Array.from(element.querySelectorAll('si-filter-pill')).map(
        (pill) => pill.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      );
    }

    it('loads with the filters of the URL and shows them in the filter bar', async () => {
      await openWith('/?q=mus&skills=python&skills=k8s&skill_match=or&min_level=3');

      expect(await respondToSearch(matching)).toBe(
        'q=mus&skills=python&skills=k8s&skill_match=or&min_level=3',
      );
      expect(element.querySelector<HTMLInputElement>('si-search-bar input')?.value).toBe('mus');
      expect(pills()).toHaveLength(2);
      expect(pills()[0]).toContain('python');
      expect(pills()[1]).toContain('k8s');
      expect(element.querySelector<HTMLInputElement>('#skill-match-or')?.checked).toBe(true);
      expect(
        element.querySelector<HTMLSelectElement>('select[aria-label="Minimum level"]')?.value,
      ).toBe('3');
    });

    it('searches by name or email after a short typing pause and puts q in the URL', async () => {
      await respond(employees);
      const input = element.querySelector<HTMLInputElement>('si-search-bar input')!;

      input.value = 'mus';
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();
      http.expectNone((r) => r.url === '/api/employees');

      // longer than the debounce of the search bar
      await new Promise((resolve) => setTimeout(resolve, 350));
      await fixture.whenStable();

      expect(await respondToSearch(matching)).toBe('q=mus');
      expect(currentUrl()).toBe('/?q=mus');
    });

    it('drops URL values the backend would reject', async () => {
      await openWith('/?min_level=9&skill_match=maybe&skills=%20&q=%20max%20');

      expect(await respondToSearch(employees)).toBe('q=max');
    });

    it('writes a chosen minimum level to the URL and searches with it', async () => {
      await respond(employees);
      const select = element.querySelector<HTMLSelectElement>(
        'select[aria-label="Minimum level"]',
      )!;

      select.value = '4';
      select.dispatchEvent(new Event('change'));
      await fixture.whenStable();

      expect(await respondToSearch(matching)).toBe('min_level=4');
      expect(currentUrl()).toBe('/?min_level=4');
    });

    it('names every level in the minimum level selector', async () => {
      await respond(employees);
      const options = Array.from(
        element.querySelectorAll('select[aria-label="Minimum level"] option'),
      ).map((option) => option.textContent?.trim());

      expect(options).toEqual([
        'Any level',
        'Min. level 1 (Beginner)',
        'Min. level 2 (Basic)',
        'Min. level 3 (Intermediate)',
        'Min. level 4 (Advanced)',
        'Min. level 5 (Expert)',
      ]);
    });

    it('offers AND/OR only for several skills and sends OR when chosen', async () => {
      await openWith('/?skills=python');
      await respondToSearch(matching);
      expect(element.querySelector('#skill-match-or')).toBeNull();

      await openWith('/?skills=python&skills=docker');
      expect(await respondToSearch(matching)).toBe('skills=python&skills=docker');

      element.querySelector<HTMLInputElement>('#skill-match-or')!.click();
      await fixture.whenStable();

      expect(await respondToSearch(matching)).toBe('skills=python&skills=docker&skill_match=or');
      expect(currentUrl()).toBe('/?skills=python&skills=docker&skill_match=or');
    });

    it('removes a skill from the search when its pill is deleted', async () => {
      await openWith('/?skills=python&skills=docker&skill_match=or');
      await respondToSearch(matching);

      element.querySelector<HTMLButtonElement>('si-filter-pill button')!.click();
      await fixture.whenStable();

      // with one skill left, OR has no meaning any more
      expect(await respondToSearch(matching)).toBe('skills=docker');
      expect(currentUrl()).toBe('/?skills=docker');
    });

    it('keeps the table visible while a search is running', async () => {
      await respond(employees);

      await openWith('/?q=max');

      expect(element.querySelector('si-loading-spinner')).toBeNull();
      expect(element.querySelectorAll('datatable-body-row')).toHaveLength(2);
      await respondToSearch(matching);
      expect(element.querySelectorAll('datatable-body-row')).toHaveLength(1);
    });

    it('shows the result of the newest search when an older answer is still pending', async () => {
      await respond(employees);
      await openWith('/?q=a');
      const older = http.expectOne((r) => r.url === '/api/employees');

      await openWith('/?q=anna');
      const newer = http.expectOne((r) => r.url === '/api/employees');

      expect(older.cancelled).toBe(true);
      newer.flush([employees[1]]);
      await fixture.whenStable();
      const rows = element.querySelectorAll('datatable-body-row');
      expect(rows).toHaveLength(1);
      expect(rows[0].textContent).toContain('Anna Schmidt');
    });

    it('marks the skills that match the search', async () => {
      await openWith('/?skills=python');
      await respondToSearch(matching);

      const badges = Array.from(element.querySelectorAll('.skill-badge'));
      expect(badges[0].classList).toContain('skill-matched');
      expect(badges[0].textContent).toContain('matches the search');
      expect(badges[1].classList).not.toContain('skill-matched');
    });

    it('explains the wildcard when a skill search finds nobody', async () => {
      await openWith('/?skills=kube');
      await respondToSearch([]);

      expect(element.querySelector('si-empty-state')?.textContent).toContain('e.g. kube*');
    });

    it('does not mention the wildcard when no skill is part of the search', async () => {
      await openWith('/?q=nobody');
      await respondToSearch([]);

      const emptyState = element.querySelector('si-empty-state');
      expect(emptyState?.textContent).toContain('No employee fits the current filters.');
      expect(emptyState?.textContent).not.toContain('*');
    });

    it('offers to reset the filters when nothing matches, and clears URL and fields', async () => {
      await openWith('/?q=nobody&min_level=5');
      await respondToSearch([]);

      const emptyState = element.querySelector('si-empty-state');
      expect(emptyState?.textContent).toContain('No employees match');
      expect(emptyState?.textContent).not.toContain('No employees yet');

      emptyState!.querySelector<HTMLButtonElement>('button')!.click();
      await fixture.whenStable();

      expect(await respondToSearch(employees)).toBe('');
      expect(currentUrl()).toBe('/');
      expect(element.querySelector<HTMLInputElement>('si-search-bar input')?.value).toBe('');
      expect(
        element.querySelector<HTMLSelectElement>('select[aria-label="Minimum level"]')?.value,
      ).toBe('');
    });
  });
});
