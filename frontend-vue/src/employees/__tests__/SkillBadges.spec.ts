import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { afterEach, describe, expect, it } from 'vitest'
import { type EmployeeSkill } from '@/api/models'
import { skillHue } from '@/skills/skill-hue'
import SkillBadges from '../SkillBadges.vue'

function skill(name: string, level: number, matched = false): EmployeeSkill {
  return { skill_id: name, name, alias: null, proficiency_level: level, matched }
}

const sixSkills = [
  skill('A', 5),
  skill('B', 4),
  skill('C', 3),
  skill('D', 2),
  skill('E', 1),
  skill('F', 1),
]

let wrapper: VueWrapper

function render(skills: EmployeeSkill[]): void {
  // attached, because the popover is rendered into document.body
  wrapper = mount(SkillBadges, {
    props: { skills },
    attachTo: document.body,
    global: { plugins: [[PrimeVue, { theme: 'none' }]] },
  })
}

function badges(root: ParentNode = wrapper.element): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('.skill-badge'))
}

function badgeTexts(root?: ParentNode): string[] {
  return badges(root).map((badge) => badge.textContent?.trim() ?? '')
}

function overflowButton() {
  return wrapper.find('.skill-overflow')
}

describe('SkillBadges', () => {
  afterEach(() => wrapper.unmount())

  it('shows name and level on every badge, in the given order', () => {
    render([skill('Python', 5), skill('Angular', 3), skill('Docker', 1)])

    expect(badgeTexts()).toEqual(['Python 5', 'Angular 3', 'Docker 1'])
  })

  it('marks each badge with the color step of its level', () => {
    render([skill('Python', 5), skill('Docker', 1)])

    expect(badges()[0]!.classList).toContain('skill-level-5')
    expect(badges()[1]!.classList).toContain('skill-level-1')
  })

  it('gives each badge the hue of its skill name, independent of the level', () => {
    render([skill('Python', 5), skill('Docker', 5)])

    const hues = badges().map((badge) => badge.style.getPropertyValue('--skill-hue'))
    expect(hues).toEqual([String(skillHue('Python')), String(skillHue('Docker'))])
    expect(hues[0]).not.toBe(hues[1])
  })

  it('shows no overflow badge when all skills fit', () => {
    render(sixSkills.slice(0, 4))

    expect(badgeTexts()).toHaveLength(4)
    expect(overflowButton().exists()).toBe(false)
  })

  it('collapses skills beyond the fourth into a +N badge', () => {
    render(sixSkills)

    expect(badgeTexts()).toEqual(['A 5', 'B 4', 'C 3', 'D 2'])
    expect(overflowButton().text()).toBe('+2')
    expect(overflowButton().attributes('aria-label')).toBe('Show 2 more skills')
  })

  it('names a single hidden skill in the singular', () => {
    render(sixSkills.slice(0, 5))

    expect(overflowButton().attributes('aria-label')).toBe('Show 1 more skill')
  })

  it('opens a popover with the remaining skills when the +N badge is clicked', async () => {
    render(sixSkills)

    await overflowButton().trigger('click')
    await flushPromises()

    const popover = document.body.querySelector('.p-popover')
    expect(popover).not.toBeNull()
    expect(badgeTexts(popover!)).toEqual(['E 1', 'F 1'])
  })

  it('shows skills that match the search first, so a match is never hidden in the popover', () => {
    render([...sixSkills.slice(0, 5), skill('F', 1, true)])

    expect(badgeTexts()).toHaveLength(4)
    expect(badgeTexts()[0]).toContain('F 1')
    expect(badges()[0]!.classList).toContain('skill-matched')
    expect(badgeTexts().slice(1)).toEqual(['A 5', 'B 4', 'C 3'])
    expect(overflowButton().text()).toBe('+2')
  })

  it('tells screen readers which skill matches the search', () => {
    render([skill('Python', 5, true), skill('Docker', 3)])

    expect(badges()[0]!.textContent).toContain('matches the search')
    expect(badges()[1]!.textContent).not.toContain('matches the search')
  })

  it('outlines the other skills when some match the search', () => {
    render([skill('Python', 5, true), skill('Docker', 3), skill('Go', 1)])

    expect(badges()[0]!.classList).not.toContain('skill-unmatched')
    expect(badges()[1]!.classList).toContain('skill-unmatched')
    expect(badges()[2]!.classList).toContain('skill-unmatched')
  })

  it('keeps every badge filled without a search', () => {
    render([skill('Python', 5), skill('Docker', 3)])

    expect(wrapper.findAll('.skill-unmatched')).toHaveLength(0)
    expect(wrapper.findAll('.skill-matched')).toHaveLength(0)
  })

  it('renders nothing for an employee without skills', () => {
    render([])

    expect(badgeTexts()).toEqual([])
    expect(overflowButton().exists()).toBe(false)
  })
})
