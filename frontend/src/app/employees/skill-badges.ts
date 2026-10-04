import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { SiPopoverBodyDirective, SiPopoverDirective } from '@siemens/element-ng/popover';
import { EmployeeSkill } from '../api/models';
import { skillHue } from '../skills/skill-hue';

// Badges shown directly in the table cell; the rest moves into the popover
export const MAX_VISIBLE_SKILLS = 4;

@Component({
  imports: [NgTemplateOutlet, SiPopoverBodyDirective, SiPopoverDirective],
  selector: 'app-skill-badges',
  styleUrl: './skill-badges.scss',
  templateUrl: './skill-badges.html',
})
export class SkillBadges {
  /** Skills as delivered by the backend: sorted by level, highest first. */
  readonly skills = input.required<EmployeeSkill[]>();

  // Skills that match the active search come first, so a match is never hidden in the popover
  private readonly ordered = computed(() => [
    ...this.skills().filter((skill) => skill.matched),
    ...this.skills().filter((skill) => !skill.matched),
  ]);
  /** With a match in the list, the other skills step back so the matches stand out. */
  protected readonly hasMatches = computed(() => this.skills().some((skill) => skill.matched));
  protected readonly visible = computed(() => this.ordered().slice(0, MAX_VISIBLE_SKILLS));
  protected readonly overflow = computed(() => this.ordered().slice(MAX_VISIBLE_SKILLS));
  protected readonly hue = skillHue;
}
