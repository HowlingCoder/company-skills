import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type Skill } from '@/api/models'
import { listSkills } from '@/api/skill-api'
import SkillPicker from '../SkillPicker.vue'

vi.mock('@/api/skill-api')

const kubernetes: Skill = { id: 's1', name: 'Kubernetes', alias: 'K8s', description: null }
const kotlin: Skill = { id: 's2', name: 'Kotlin', alias: null, description: null }

// longer than the delay of the autocomplete
const DELAY_MS = 250

let wrapper: VueWrapper

function render(props: Record<string, unknown> = {}): void {
  wrapper = mount(SkillPicker, {
    props: { inputId: 'picker', ...props },
    attachTo: document.body,
    global: { plugins: [[PrimeVue, { theme: 'none' }]] },
  })
}

function input() {
  return wrapper.find<HTMLInputElement>('input#picker')
}

/** Types into the picker and lets the catalog lookup answer with `result`. */
async function search(term: string, result: Skill[]): Promise<void> {
  vi.mocked(listSkills).mockResolvedValue(result)
  await input().trigger('focus')
  await input().setValue(term)
  await new Promise((resolve) => setTimeout(resolve, DELAY_MS))
  await flushPromises()
}

function options(): HTMLElement[] {
  return Array.from(document.body.querySelectorAll<HTMLElement>('.p-autocomplete-option'))
}

async function pressEnter(): Promise<void> {
  await input().trigger('keydown', { key: 'Enter', code: 'Enter' })
  await new Promise((resolve) => setTimeout(resolve))
  await flushPromises()
}

describe('SkillPicker', () => {
  beforeEach(() => vi.mocked(listSkills).mockReset().mockResolvedValue([]))
  afterEach(() => wrapper.unmount())

  it('searches the catalog on the server and shows name and alias', async () => {
    render()

    await search('k', [kotlin, kubernetes])

    expect(listSkills).toHaveBeenLastCalledWith('k')
    expect(options().map((option) => option.textContent?.trim())).toEqual([
      'Kotlin',
      'Kubernetes (K8s)',
    ])
  })

  it('does not offer skills that are excluded', async () => {
    render({ excludedSkillIds: ['s1'] })

    await search('k', [kotlin, kubernetes])

    expect(options().map((option) => option.textContent?.trim())).toEqual(['Kotlin'])
  })

  it('emits the chosen skill and clears the input', async () => {
    render()
    await search('kub', [kubernetes])

    options()[0]!.click()
    await flushPromises()

    expect(wrapper.emitted('skillSelected')).toEqual([[kubernetes]])
    expect(input().element.value).toBe('')
  })

  it('offers the whole catalog, not only the first matches', async () => {
    render()
    const catalog: Skill[] = Array.from({ length: 25 }, (_, index) => ({
      id: `c${index}`,
      name: `Skill ${index}`,
      alias: null,
      description: null,
    }))

    await search('skill', catalog)

    expect(options()).toHaveLength(25)
  })

  it('says so when the typed text matches no skill', async () => {
    render()

    await search('cobol', [])

    expect(wrapper.text()).toContain('No matching skill in the catalog.')
  })

  it('says so when every match is excluded, e.g. already assigned', async () => {
    render({ excludedSkillIds: ['s1'] })

    await search('kub', [kubernetes])

    expect(options()).toHaveLength(0)
    expect(wrapper.text()).toContain('Already assigned.')
    expect(wrapper.text()).not.toContain('No matching skill')
  })

  it('shows no hint while a match is left next to an excluded one', async () => {
    render({ excludedSkillIds: ['s1'] })

    await search('k', [kotlin, kubernetes])

    expect(wrapper.text()).not.toContain('Already assigned.')
    expect(wrapper.text()).not.toContain('No matching skill')
  })

  it('waits for the minimum length before it looks up suggestions', async () => {
    render({ minLength: 2 })

    await search('k', [kotlin])

    expect(listSkills).not.toHaveBeenCalledWith('k')
    expect(options()).toHaveLength(0)
  })

  it('does not submit free text unless it is allowed', async () => {
    render()
    await search('zzz', [])

    await pressEnter()

    expect(wrapper.emitted('termEntered')).toBeUndefined()
    expect(input().element.value).toBe('zzz')
  })

  it('can be focused from outside', () => {
    render()

    ;(wrapper.vm as unknown as { focus(): void }).focus()

    expect(document.activeElement).toBe(input().element)
  })

  describe('with free text', () => {
    it('submits the typed text on Enter, e.g. a wildcard, and clears the input', async () => {
      render({ allowFreeText: true })
      await search('c*', [])

      await pressEnter()

      expect(wrapper.emitted('termEntered')).toEqual([['c*']])
      expect(wrapper.emitted('skillSelected')).toBeUndefined()
      expect(input().element.value).toBe('')
    })

    it('does not pick the first suggestion on Enter', async () => {
      render({ allowFreeText: true })
      await search('k', [kotlin, kubernetes])

      await pressEnter()

      expect(wrapper.emitted('termEntered')).toEqual([['k']])
      expect(wrapper.emitted('skillSelected')).toBeUndefined()
    })

    it('ignores Enter on an empty input', async () => {
      render({ allowFreeText: true })

      await pressEnter()

      expect(wrapper.emitted('termEntered')).toBeUndefined()
    })

    it('shows no hint, where a term like a wildcard needs no match', async () => {
      render({ allowFreeText: true })

      await search('c*', [])

      expect(wrapper.text()).not.toContain('No matching skill')
    })
  })
})
