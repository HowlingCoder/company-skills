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
import { EMPLOYEES_IMPORTED, ImportDialog } from './import-dialog';
import { SkillBadges } from './skill-badges';

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
  protected readonly retryAction: Link = { title: 'Retry', action: () => this.load() };

  constructor() {
    this.load();
  }

  protected load(): void {
    this.state.set('loading');
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
}
