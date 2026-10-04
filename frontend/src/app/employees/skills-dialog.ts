import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { SiFormItemComponent } from '@siemens/element-ng/form';
import { SiInlineNotificationComponent } from '@siemens/element-ng/inline-notification';
import { ModalRef } from '@siemens/element-ng/modal';
import { EmployeeApi } from '../api/employee-api';
import { Employee, Skill } from '../api/models';
import { PROFICIENCY_LEVELS, skillLabel } from '../skills/levels';
import { SkillPicker } from '../skills/skill-picker';

/** Close value of the dialog after the skills were saved. */
export const SKILLS_SAVED = 'saved';

const UNEXPECTED_ERROR = 'The server did not answer as expected. Please try again.';

interface SkillEntry {
  skillId: string;
  label: string;
  /** null until the team lead picked a level for a newly added skill */
  level: number | null;
}

/** Modal 1: manage all skills of one employee and save them as one full state. */
@Component({
  imports: [SiFormItemComponent, SiInlineNotificationComponent, SkillPicker],
  selector: 'app-skills-dialog',
  templateUrl: './skills-dialog.html',
})
export class SkillsDialog {
  protected readonly modalRef = inject<ModalRef<SkillsDialog, string>>(ModalRef);
  private readonly employeeApi = inject(EmployeeApi);

  readonly employee = input.required<Employee>();

  protected readonly levels = PROFICIENCY_LEVELS;
  protected readonly entries = linkedSignal<SkillEntry[]>(() =>
    this.employee().skills.map((skill) => ({
      skillId: skill.skill_id,
      label: skillLabel(skill),
      level: skill.proficiency_level,
    })),
  );
  protected readonly assignedIds = computed(() => this.entries().map((entry) => entry.skillId));
  protected readonly canSave = computed(() =>
    this.entries().every((entry) => entry.level !== null),
  );
  protected readonly saving = signal(false);
  protected readonly error = signal<string | undefined>(undefined);

  protected add(skill: Skill): void {
    if (this.assignedIds().includes(skill.id)) {
      return;
    }
    this.entries.update((entries) => [
      ...entries,
      { skillId: skill.id, label: skillLabel(skill), level: null },
    ]);
  }

  protected setLevel(skillId: string, value: string): void {
    this.entries.update((entries) =>
      entries.map((entry) =>
        entry.skillId === skillId ? { ...entry, level: Number(value) } : entry,
      ),
    );
  }

  protected remove(skillId: string): void {
    this.entries.update((entries) => entries.filter((entry) => entry.skillId !== skillId));
  }

  protected save(): void {
    if (!this.canSave() || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.error.set(undefined);
    const skills = this.entries().map((entry) => ({
      skill_id: entry.skillId,
      proficiency_level: entry.level as number,
    }));
    this.employeeApi.setSkills(this.employee().id, skills).subscribe({
      next: () => this.modalRef.hide(SKILLS_SAVED),
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(this.errorMessage(error));
      },
    });
  }

  private errorMessage(error: unknown): string {
    // 404: the employee or a skill was deleted in the meantime; the backend names it
    if (error instanceof HttpErrorResponse && error.status === 404) {
      const detail = error.error?.detail;
      if (typeof detail === 'string') {
        return detail;
      }
    }
    return UNEXPECTED_ERROR;
  }
}
