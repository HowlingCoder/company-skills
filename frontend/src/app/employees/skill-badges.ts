import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { SiPopoverBodyDirective, SiPopoverDirective } from '@siemens/element-ng/popover';
import { EmployeeSkill } from '../api/models';

// Badges shown directly in the table cell; the rest moves into the popover
export const MAX_VISIBLE_SKILLS = 4;

@Component({
  imports: [NgTemplateOutlet, SiPopoverBodyDirective, SiPopoverDirective],
  selector: 'app-skill-badges',
  styleUrl: './skill-badges.scss',
  templateUrl: './skill-badges.html',
})
export class SkillBadges {
  /** Skills in display order; the backend sorts them by level, highest first. */
  readonly skills = input.required<EmployeeSkill[]>();

  protected readonly visible = computed(() => this.skills().slice(0, MAX_VISIBLE_SKILLS));
  protected readonly overflow = computed(() => this.skills().slice(MAX_VISIBLE_SKILLS));
}
