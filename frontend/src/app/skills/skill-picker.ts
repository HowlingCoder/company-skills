import { Component, computed, inject, input, output } from '@angular/core';
import { SI_FORM_ITEM_CONTROL, SiFormItemControl } from '@siemens/element-ng/form';
import {
  SiTypeaheadDirective,
  TypeaheadMatch,
  TypeaheadOptionSource,
} from '@siemens/element-ng/typeahead';
import { map } from 'rxjs';
import { Skill } from '../api/models';
import { SkillApi } from '../api/skill-api';
import { skillLabel } from './levels';

/** Autocomplete over the skill catalog; emits the chosen skill and clears itself. */
@Component({
  imports: [SiTypeaheadDirective],
  // lets a surrounding si-form-item point its label at the input
  providers: [{ provide: SI_FORM_ITEM_CONTROL, useExisting: SkillPicker }],
  selector: 'app-skill-picker',
  templateUrl: './skill-picker.html',
})
export class SkillPicker implements SiFormItemControl {
  private readonly skillApi = inject(SkillApi);

  readonly inputId = input.required<string>();
  readonly id = this.inputId;
  readonly errormessageId = computed(() => `${this.inputId()}-error`);
  /** Skills that are not offered, e.g. because they are already assigned. */
  readonly excludedSkillIds = input<string[]>([]);
  readonly skillSelected = output<Skill>();

  // The backend searches name and alias; the label carries both, so the typeahead can
  // highlight the matching part
  protected readonly source: TypeaheadOptionSource = (search) =>
    this.skillApi
      .list(search)
      .pipe(
        map((skills) =>
          skills
            .filter((skill) => !this.excludedSkillIds().includes(skill.id))
            .map((skill) => ({ skill, label: skillLabel(skill) })),
        ),
      );

  protected onSelect(match: TypeaheadMatch): void {
    this.skillSelected.emit((match.option as { skill: Skill }).skill);
  }
}
