import {
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { SI_FORM_ITEM_CONTROL, SiFormItemControl } from '@siemens/element-ng/form';
import {
  SiTypeaheadDirective,
  TypeaheadMatch,
  TypeaheadOptionSource,
} from '@siemens/element-ng/typeahead';
import { map, tap } from 'rxjs';
import { Skill } from '../api/models';
import { SkillApi } from '../api/skill-api';
import { skillLabel } from './levels';

/** Autocomplete over the skill catalog; emits the chosen skill or term and clears itself. */
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
  readonly placeholder = input('Search the skill catalog');
  readonly ariaLabel = input<string>();
  /** Skills that are not offered, e.g. because they are already assigned. */
  readonly excludedSkillIds = input<string[]>([]);
  /**
   * Lets Enter submit the typed text as it is, e.g. a wildcard like "c*". No suggestion is
   * preselected then, so Enter only picks a suggestion the user moved to.
   */
  readonly allowFreeText = input(false);
  /** Typed characters before suggestions open; 0 opens the list as soon as the input has focus. */
  readonly minLength = input(0);
  readonly skillSelected = output<Skill>();
  readonly termEntered = output<string>();

  private readonly inputElement = viewChild.required<ElementRef<HTMLInputElement>>('input');
  /** The typed text matches nothing in the catalog. */
  protected readonly noMatch = signal(false);

  // The backend searches name and alias; the label carries both, so the typeahead can
  // highlight the matching part
  protected readonly source: TypeaheadOptionSource = (search) =>
    this.skillApi.list(search).pipe(
      tap((skills) => this.noMatch.set(search.trim() !== '' && !skills.length)),
      map((skills) =>
        skills
          .filter((skill) => !this.excludedSkillIds().includes(skill.id))
          .map((skill) => ({ skill, label: skillLabel(skill) })),
      ),
    );

  focus(): void {
    this.inputElement().nativeElement.focus();
  }

  protected onSelect(match: TypeaheadMatch): void {
    this.noMatch.set(false);
    this.skillSelected.emit((match.option as { skill: Skill }).skill);
  }

  protected onEnter(input: HTMLInputElement): void {
    if (!this.allowFreeText()) {
      return;
    }
    // The typeahead handles Enter first: if a suggestion was picked, the input is empty by now
    setTimeout(() => {
      const term = input.value.trim();
      if (term) {
        input.value = '';
        input.dispatchEvent(new Event('input'));
        this.termEntered.emit(term);
      }
    });
  }
}
