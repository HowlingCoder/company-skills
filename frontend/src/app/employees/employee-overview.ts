import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { SiDatatableModule } from '@siemens/element-ng/datatable';
import { SiEmptyStateComponent } from '@siemens/element-ng/empty-state';
import { SiInlineNotificationComponent } from '@siemens/element-ng/inline-notification';
import { Link } from '@siemens/element-ng/link';
import { SiLoadingSpinnerComponent } from '@siemens/element-ng/loading-spinner';
import { SiModalService } from '@siemens/element-ng/modal';
import { NgxDatatableModule, SortPropDir } from '@siemens/ngx-datatable';
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  distinctUntilChanged,
  map,
  of,
  switchMap,
  tap,
} from 'rxjs';
import { EmployeeApi } from '../api/employee-api';
import { Employee } from '../api/models';
import { AssignSkillDialog, SKILL_ASSIGNED } from './assign-skill-dialog';
import {
  ActiveFilter,
  EMPTY_FILTER,
  filterQueryParams,
  isFilterActive,
  parseFilter,
  toApiFilter,
} from './employee-filter-url';
import { EmployeeFilters } from './employee-filters';
import { EMPLOYEES_IMPORTED, ImportDialog } from './import-dialog';
import { SkillBadges } from './skill-badges';
import { SKILLS_SAVED, SkillsDialog } from './skills-dialog';

@Component({
  imports: [
    EmployeeFilters,
    NgxDatatableModule,
    SiDatatableModule,
    SiEmptyStateComponent,
    SiInlineNotificationComponent,
    SiLoadingSpinnerComponent,
    SkillBadges,
  ],
  selector: 'app-employee-overview',
  templateUrl: './employee-overview.html',
})
export class EmployeeOverview {
  private readonly employeeApi = inject(EmployeeApi);
  private readonly modalService = inject(SiModalService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  /** The filter lives in the URL query params, so it survives a reload and can be shared. */
  protected readonly filter = signal<ActiveFilter>(EMPTY_FILTER);
  protected readonly filterActive = computed(() => isFilterActive(this.filter()));
  /** A skill term matches the whole name or alias, which is the usual reason for an empty result. */
  protected readonly noMatchText = computed(() =>
    this.filter().skills.length
      ? 'No employee fits the current filters. Skills match the whole name or alias; add * for a partial match, e.g. kube*.'
      : 'No employee fits the current filters.',
  );
  /** 'loading' only until the first answer; later searches keep the table and set `loading`. */
  protected readonly state = signal<'loading' | 'loaded' | 'error'>('loading');
  protected readonly loading = signal(true);
  private readonly reload = new BehaviorSubject<void>(undefined);
  protected readonly employees = signal<Employee[]>([]);
  // name is a single sortable column, so the rows carry the full name
  protected readonly rows = computed(() =>
    this.employees().map((employee) => ({
      ...employee,
      name: `${employee.firstname} ${employee.lastname}`,
    })),
  );
  /** Rows ticked in the table, for assigning one skill to all of them. */
  protected readonly selected = signal<Employee[]>([]);
  protected readonly retryAction: Link = { title: 'Retry', action: () => this.load() };
  // rows are compared by id, so a tick survives when the row objects are rebuilt
  protected readonly rowIdentity = (row: object): unknown => ('id' in row ? row.id : row);
  // The backend delivers the rows by last name; telling the table shows the sort arrow from the start
  protected readonly initialSorts: SortPropDir[] = [{ prop: 'name', dir: 'asc' }];
  /** The name column shows "Firstname Lastname" but sorts like the backend: last name first. */
  protected readonly byLastname = (_a: unknown, _b: unknown, a: Employee, b: Employee): number =>
    a.lastname.localeCompare(b.lastname, undefined, { sensitivity: 'base' }) ||
    a.firstname.localeCompare(b.firstname, undefined, { sensitivity: 'base' });

  constructor() {
    const filter = this.route.queryParamMap.pipe(
      map(parseFilter),
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
    );
    combineLatest([filter, this.reload])
      .pipe(
        tap(([activeFilter]) => {
          this.filter.set(activeFilter);
          this.loading.set(true);
          // the selection refers to rows of the previous load
          this.selected.set([]);
        }),
        // switchMap drops the answer of an older search when a newer one is under way
        switchMap(([activeFilter]) =>
          this.employeeApi.list(toApiFilter(activeFilter)).pipe(catchError(() => of(null))),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((employees) => {
        this.loading.set(false);
        if (employees === null) {
          this.state.set('error');
        } else {
          this.employees.set(employees);
          this.state.set('loaded');
        }
      });
  }

  protected load(): void {
    this.reload.next();
  }

  protected applyFilter(filter: ActiveFilter): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: filterQueryParams(filter),
      replaceUrl: true,
    });
  }

  protected resetFilter(): void {
    this.applyFilter(EMPTY_FILTER);
  }

  protected openImport(): void {
    const modalRef = this.modalService.show<ImportDialog, string>(ImportDialog, {
      ariaLabelledBy: 'import-dialog-title',
      // Element modals ignore Escape and backdrop clicks unless told otherwise
      keyboard: true,
      ignoreBackdropClick: false,
    });
    // the dialog stays open after a partial import, so it reports imports as messages
    modalRef.message.subscribe((message) => {
      if (message === EMPLOYEES_IMPORTED) {
        this.load();
      }
    });
  }

  protected openAssign(): void {
    const modalRef = this.modalService.show<AssignSkillDialog, string>(AssignSkillDialog, {
      ariaLabelledBy: 'assign-skill-dialog-title',
      // no `keyboard`: Escape must not throw away a choice that is not assigned yet
      inputValues: { employees: this.selected() },
    });
    modalRef.hidden.subscribe((closeValue) => {
      if (closeValue === SKILL_ASSIGNED) {
        this.load();
      }
    });
  }

  protected openSkills(employee: Employee): void {
    const modalRef = this.modalService.show<SkillsDialog, string>(SkillsDialog, {
      ariaLabelledBy: 'skills-dialog-title',
      // no `keyboard`: Escape must not throw away unsaved changes
      inputValues: { employee },
    });
    modalRef.hidden.subscribe((closeValue) => {
      if (closeValue === SKILLS_SAVED) {
        this.load();
      }
    });
  }
}
