import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SiFormItemComponent } from '@siemens/element-ng/form';
import { SiInlineNotificationComponent } from '@siemens/element-ng/inline-notification';
import { ModalRef } from '@siemens/element-ng/modal';
import { SiToastNotificationService } from '@siemens/element-ng/toast-notification';
import { Employee, Skill } from '../api/models';
import { SkillAssignmentApi } from '../api/skill-assignment-api';
import { PROFICIENCY_LEVELS, skillLabel } from '../skills/levels';
import { SkillPicker } from '../skills/skill-picker';

/** Close value of the dialog after the skill was assigned. */
export const SKILL_ASSIGNED = 'assigned';

const UNEXPECTED_ERROR = 'The server did not answer as expected. Please try again.';

interface Conflict {
  employeeId: string;
  name: string;
  level: number;
}

/** Modal 2: assign one skill with one level to all selected employees. */
@Component({
  imports: [FormsModule, SiFormItemComponent, SiInlineNotificationComponent, SkillPicker],
  selector: 'app-assign-skill-dialog',
  templateUrl: './assign-skill-dialog.html',
})
export class AssignSkillDialog {
  protected readonly modalRef = inject<ModalRef<AssignSkillDialog, string>>(ModalRef);
  private readonly skillAssignmentApi = inject(SkillAssignmentApi);
  private readonly toasts = inject(SiToastNotificationService);

  readonly employees = input.required<Employee[]>();

  protected readonly levels = PROFICIENCY_LEVELS;
  protected readonly skillLabel = skillLabel;
  protected readonly skill = signal<Skill | undefined>(undefined);
  protected readonly level = signal<number | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | undefined>(undefined);

  /**
   * Preview from the table data: who already has the chosen skill. The backend checks the
   * conflicts itself and reports what really happened.
   */
  protected readonly conflicts = computed<Conflict[]>(() => {
    const skillId = this.skill()?.id;
    if (!skillId) {
      return [];
    }
    return this.employees().flatMap((employee) => {
      const existing = employee.skills.find((skill) => skill.skill_id === skillId);
      return existing
        ? [
            {
              employeeId: employee.id,
              name: `${employee.firstname} ${employee.lastname}`,
              level: existing.proficiency_level,
            },
          ]
        : [];
    });
  });
  protected readonly conflictHeading = computed(() => {
    const count = this.conflicts().length;
    return `${count} of the selected employees already ${count === 1 ? 'has' : 'have'} this skill`;
  });
  protected readonly canSubmit = computed(
    () => this.skill() !== undefined && this.level() !== null && !this.saving(),
  );

  protected setLevel(value: string): void {
    this.level.set(Number(value));
  }

  protected submit(overwrite = false): void {
    const skill = this.skill();
    const level = this.level();
    if (!skill || level === null || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.error.set(undefined);
    this.skillAssignmentApi
      .bulkAssign(
        {
          employee_ids: this.employees().map((employee) => employee.id),
          skill_id: skill.id,
          proficiency_level: level,
        },
        overwrite,
      )
      .subscribe({
        next: (result) => {
          const changed = result.created.length + result.updated.length;
          this.toasts.queueToastNotification(
            changed ? 'success' : 'info',
            changed ? `${skill.name} assigned` : 'Nothing changed',
            `${result.created.length} assigned, ${result.updated.length} updated, ` +
              `${result.skipped.length} skipped.`,
          );
          this.modalRef.hide(SKILL_ASSIGNED);
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(this.errorMessage(error));
        },
      });
  }

  private errorMessage(error: unknown): string {
    // 404: an employee or the skill was deleted in the meantime; nothing was written
    if (error instanceof HttpErrorResponse && error.status === 404) {
      const detail = error.error?.detail;
      if (typeof detail === 'string') {
        return detail;
      }
    }
    return UNEXPECTED_ERROR;
  }
}
