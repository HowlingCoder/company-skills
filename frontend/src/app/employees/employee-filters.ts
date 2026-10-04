import { Component, input, output } from '@angular/core';
import { SiFilterPillComponent } from '@siemens/element-ng/filter-bar';
import { SiSearchBarComponent } from '@siemens/element-ng/search-bar';
import { Skill } from '../api/models';
import { PROFICIENCY_LEVELS } from '../skills/levels';
import { SkillPicker } from '../skills/skill-picker';
import { ActiveFilter } from './employee-filter-url';

/** Filter bar above the employee table; reports every change as a complete filter. */
@Component({
  imports: [SiFilterPillComponent, SiSearchBarComponent, SkillPicker],
  selector: 'app-employee-filters',
  templateUrl: './employee-filters.html',
})
export class EmployeeFilters {
  readonly filter = input.required<ActiveFilter>();
  readonly filterChange = output<ActiveFilter>();

  protected readonly levels = PROFICIENCY_LEVELS;

  protected setQuery(q: string | undefined): void {
    const value = (q ?? '').trim();
    if (value !== this.filter().q) {
      this.filterChange.emit({ ...this.filter(), q: value });
    }
  }

  protected addSkill(skill: Skill): void {
    this.addTerm(skill.name);
  }

  /** Free text, e.g. a wildcard like "c*" or an alias. */
  protected addTerm(term: string): void {
    const skills = this.filter().skills;
    if (skills.some((existing) => existing.toLowerCase() === term.toLowerCase())) {
      return;
    }
    this.filterChange.emit({ ...this.filter(), skills: [...skills, term] });
  }

  protected removeTerm(term: string): void {
    const skills = this.filter().skills.filter((existing) => existing !== term);
    this.filterChange.emit({
      ...this.filter(),
      skills,
      skillMatch: skills.length > 1 ? this.filter().skillMatch : 'and',
    });
  }

  protected setSkillMatch(skillMatch: 'and' | 'or'): void {
    this.filterChange.emit({ ...this.filter(), skillMatch });
  }

  protected setMinLevel(value: string): void {
    this.filterChange.emit({ ...this.filter(), minLevel: value ? Number(value) : null });
  }
}
