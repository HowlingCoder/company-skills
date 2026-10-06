import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmployeeSkill } from '../api/models';
import { skillHue } from '../skills/skill-hue';
import { SkillBadges } from './skill-badges';

function skill(name: string, level: number): EmployeeSkill {
  return { skill_id: name, name, alias: null, proficiency_level: level, matched: false };
}

describe('SkillBadges', () => {
  let fixture: ComponentFixture<SkillBadges>;
  let element: HTMLElement;

  async function render(skills: EmployeeSkill[]): Promise<void> {
    fixture = TestBed.createComponent(SkillBadges);
    fixture.componentRef.setInput('skills', skills);
    await fixture.whenStable();
    element = fixture.nativeElement;
  }

  function badgeTexts(root: ParentNode = element): string[] {
    return Array.from(root.querySelectorAll('.skill-badge')).map(
      (badge) => badge.textContent?.trim() ?? '',
    );
  }

  it('shows name and level on every badge, in the given order', async () => {
    await render([skill('Python', 5), skill('Angular', 3), skill('Docker', 1)]);

    expect(badgeTexts()).toEqual(['Python 5', 'Angular 3', 'Docker 1']);
  });

  it('marks each badge with the color step of its level', async () => {
    await render([skill('Python', 5), skill('Docker', 1)]);

    const badges = element.querySelectorAll('.skill-badge');
    expect(badges[0].classList).toContain('skill-level-5');
    expect(badges[1].classList).toContain('skill-level-1');
  });

  it('gives each badge the hue of its skill name, independent of the level', async () => {
    await render([skill('Python', 5), skill('Docker', 5)]);

    const hues = Array.from(element.querySelectorAll<HTMLElement>('.skill-badge')).map((badge) =>
      badge.style.getPropertyValue('--skill-hue'),
    );
    expect(hues).toEqual([String(skillHue('Python')), String(skillHue('Docker'))]);
    expect(hues[0]).not.toBe(hues[1]);
  });

  it('shows no overflow badge when all skills fit', async () => {
    await render([skill('A', 4), skill('B', 3), skill('C', 2), skill('D', 1)]);

    expect(badgeTexts()).toHaveLength(4);
    expect(element.querySelector('.skill-overflow')).toBeNull();
  });

  it('collapses skills beyond the fourth into a +N badge', async () => {
    await render([
      skill('A', 5),
      skill('B', 4),
      skill('C', 3),
      skill('D', 2),
      skill('E', 1),
      skill('F', 1),
    ]);

    expect(badgeTexts()).toEqual(['A 5', 'B 4', 'C 3', 'D 2']);
    const overflow = element.querySelector('.skill-overflow');
    expect(overflow?.textContent?.trim()).toBe('+2');
    expect(overflow?.getAttribute('aria-label')).toBe('Show 2 more skills');
  });

  it('names a single hidden skill in the singular', async () => {
    await render([skill('A', 5), skill('B', 4), skill('C', 3), skill('D', 2), skill('E', 1)]);

    expect(element.querySelector('.skill-overflow')?.getAttribute('aria-label')).toBe(
      'Show 1 more skill',
    );
  });

  it('opens a popover with the remaining skills when the +N badge is clicked', async () => {
    await render([
      skill('A', 5),
      skill('B', 4),
      skill('C', 3),
      skill('D', 2),
      skill('E', 1),
      skill('F', 1),
    ]);

    element.querySelector<HTMLButtonElement>('.skill-overflow')?.click();
    await fixture.whenStable();
    // the popover moves the focus in a timeout after it is rendered
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();

    const popover = document.querySelector('si-popover');
    expect(popover).not.toBeNull();
    expect(badgeTexts(popover!)).toEqual(['E 1', 'F 1']);
  });

  it('shows skills that match the search first, so a match is never hidden in the popover', async () => {
    const lowMatch: EmployeeSkill = { ...skill('F', 1), matched: true };

    await render([
      skill('A', 5),
      skill('B', 4),
      skill('C', 3),
      skill('D', 2),
      skill('E', 1),
      lowMatch,
    ]);

    const visible = Array.from(element.querySelectorAll('.skill-badge'));
    expect(visible).toHaveLength(4);
    expect(visible[0].textContent).toContain('F 1');
    expect(visible[0].classList).toContain('skill-matched');
    expect(visible.slice(1).map((badge) => badge.textContent?.trim())).toEqual([
      'A 5',
      'B 4',
      'C 3',
    ]);
    expect(element.querySelector('.skill-overflow')?.textContent?.trim()).toBe('+2');
  });

  it('outlines the other skills when some match the search', async () => {
    await render([{ ...skill('Python', 5), matched: true }, skill('Docker', 3), skill('Go', 1)]);

    const badges = Array.from(element.querySelectorAll('.skill-badge'));
    expect(badges[0].classList).not.toContain('skill-unmatched');
    expect(badges[1].classList).toContain('skill-unmatched');
    expect(badges[2].classList).toContain('skill-unmatched');
  });

  it('keeps every badge filled without a search', async () => {
    await render([skill('Python', 5), skill('Docker', 3)]);

    expect(element.querySelectorAll('.skill-unmatched')).toHaveLength(0);
    expect(element.querySelectorAll('.skill-matched')).toHaveLength(0);
  });

  it('renders nothing for an employee without skills', async () => {
    await render([]);

    expect(badgeTexts()).toEqual([]);
    expect(element.querySelector('.skill-overflow')).toBeNull();
  });
});
