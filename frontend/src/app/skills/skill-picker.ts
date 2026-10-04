import { Component, inject, input, output } from '@angular/core';
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
  selector: 'app-skill-picker',
  templateUrl: './skill-picker.html',
})
export class SkillPicker {
  private readonly skillApi = inject(SkillApi);

  readonly inputId = input.required<string>();
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
