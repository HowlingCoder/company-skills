import { Component, computed, inject, signal } from '@angular/core';
import { SiDatatableModule } from '@siemens/element-ng/datatable';
import { SiEmptyStateComponent } from '@siemens/element-ng/empty-state';
import { SiInlineNotificationComponent } from '@siemens/element-ng/inline-notification';
import { Link } from '@siemens/element-ng/link';
import { SiLoadingSpinnerComponent } from '@siemens/element-ng/loading-spinner';
import { SiModalService } from '@siemens/element-ng/modal';
import { NgxDatatableModule } from '@siemens/ngx-datatable';
import { EmployeeApi } from '../api/employee-api';
import { Employee } from '../api/models';
import { AssignSkillDialog, SKILL_ASSIGNED } from './assign-skill-dialog';
import { EMPLOYEES_IMPORTED, ImportDialog } from './import-dialog';
import { SkillBadges } from './skill-badges';
import { SKILLS_SAVED, SkillsDialog } from './skills-dialog';

@Component({
  imports: [
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

  protected readonly state = signal<'loading' | 'loaded' | 'error'>('loading');
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

  constructor() {
    this.load();
  }

  protected load(): void {
    this.state.set('loading');
    // the selection refers to rows of the previous load
    this.selected.set([]);
    this.employeeApi.list().subscribe({
      next: (employees) => {
        this.employees.set(employees);
        this.state.set('loaded');
      },
      error: () => this.state.set('error'),
    });
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
      inputValues: { employees: this.selected() },
      keyboard: true,
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
      inputValues: { employee },
      keyboard: true,
    });
    modalRef.hidden.subscribe((closeValue) => {
      if (closeValue === SKILLS_SAVED) {
        this.load();
      }
    });
  }
}
