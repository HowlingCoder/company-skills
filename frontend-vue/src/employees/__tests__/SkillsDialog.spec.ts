import { flushPromises, type VueWrapper } from '@vue/test-utils'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setSkills } from '@/api/employee-api'
import { HttpError } from '@/api/http'
import { type Employee, type Skill } from '@/api/models'
import SkillPicker from '@/skills/SkillPicker.vue'
import SkillsDialog from '../SkillsDialog.vue'
import { dialog, dialogButton, mountDialog } from './dialog-helpers'

const toast = { add: vi.fn<(message: object) => void>() }
vi.mock('primevue/usetoast', () => ({ useToast: () => toast }))
vi.mock('@/api/employee-api')
vi.mock('@/api/skill-api', () => ({
  listSkills: vi.fn<() => Promise<unknown[]>>().mockResolvedValue([]),
}))

const employee: Employee = {
  id: 'e1',
  firstname: 'Max',
  lastname: 'Muster',
  email: 'max.muster@example.com',
  age: 34,
  skills: [
    { skill_id: 's1', name: 'Python', alias: 'py', proficiency_level: 5, matched: false },
    { skill_id: 's2', name: 'Docker', alias: null, proficiency_level: 2, matched: false },
  ],
}
const kotlin: Skill = { id: 's3', name: 'Kotlin', alias: null, description: null }

let wrapper: VueWrapper

function rows(): HTMLElement[] {
  return Array.from(dialog().querySelectorAll<HTMLElement>('ul[aria-label="Assigned skills"] li'))
}

function levels() {
  return wrapper.findAllComponents(Select)
}

async function addSkill(skill: Skill): Promise<void> {
  wrapper.findComponent(SkillPicker).vm.$emit('skillSelected', skill)
  await flushPromises()
}

async function click(label: string): Promise<void> {
  dialogButton(label)!.click()
  await flushPromises()
}

describe('SkillsDialog', () => {
  beforeEach(async () => {
    vi.mocked(setSkills).mockReset().mockResolvedValue(employee)
    toast.add.mockReset()
    wrapper = mountDialog(SkillsDialog, { employee })
    await flushPromises()
  })

  afterEach(() => wrapper.unmount())

  it('names the employee and lists the current skills with their levels', () => {
    expect(dialog().textContent).toContain('Skills of Max Muster')
    expect(rows().map((row) => row.querySelector('.label')?.textContent)).toEqual([
      'Python (py)',
      'Docker',
    ])
    expect(levels().map((select) => select.props('modelValue'))).toEqual([5, 2])
  })

  it('links the "Add skill" label to the picker input', () => {
    const label = dialog().querySelector('label[for="skills-dialog-add"]')

    expect(label?.textContent).toBe('Add skill')
    expect(dialog().querySelector('input#skills-dialog-add')).not.toBeNull()
  })

  it('saves level changes, removals and additions as one full state', async () => {
    levels()[1]!.vm.$emit('update:modelValue', 3)
    await click('Remove Python (py)')
    await addSkill(kotlin)
    levels()[1]!.vm.$emit('update:modelValue', 1)
    await flushPromises()

    await click('Save')

    expect(setSkills).toHaveBeenCalledWith('e1', [
      { skill_id: 's2', proficiency_level: 3 },
      { skill_id: 's3', proficiency_level: 1 },
    ])
    expect(wrapper.emitted('saved')).toHaveLength(1)
  })

  it('sends an empty list when every skill was removed', async () => {
    await click('Remove Python (py)')
    await click('Remove Docker')
    expect(dialog().textContent).toContain('No skills assigned yet.')

    await click('Save')

    expect(setSkills).toHaveBeenCalledWith('e1', [])
  })

  it('blocks saving until a newly added skill has a level', async () => {
    await addSkill(kotlin)
    expect(dialogButton('Save')!.disabled).toBe(true)

    levels()[2]!.vm.$emit('update:modelValue', 4)
    await flushPromises()

    expect(dialogButton('Save')!.disabled).toBe(false)
  })

  it('keeps assigned skills out of the picker and ignores a skill added twice', async () => {
    expect(wrapper.findComponent(SkillPicker).props('excludedSkillIds')).toEqual(['s1', 's2'])

    await addSkill(kotlin)
    await addSkill(kotlin)

    expect(rows()).toHaveLength(3)
    expect(wrapper.findComponent(SkillPicker).props('excludedSkillIds')).toEqual(['s1', 's2', 's3'])
  })

  it('shows the reason from the backend and stays open when a skill no longer exists', async () => {
    vi.mocked(setSkills).mockRejectedValue(new HttpError('x', 404, 'Skill s2 not found'))

    await click('Save')

    expect(dialog().textContent).toContain('Skills could not be saved')
    expect(dialog().textContent).toContain('Skill s2 not found')
    expect(wrapper.emitted('saved')).toBeUndefined()
    expect(dialogButton('Save')!.disabled).toBe(false)
  })

  it('shows a generic message when the server fails', async () => {
    vi.mocked(setSkills).mockRejectedValue(new HttpError('x', 500, 'Internal'))

    await click('Save')

    expect(dialog().textContent).toContain('The server did not answer as expected.')
    expect(dialog().textContent).not.toContain('Internal')
  })

  it('closes without a request on cancel', async () => {
    await click('Cancel')

    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(setSkills).not.toHaveBeenCalled()
  })

  it('keeps the dialog open on Escape, so unsaved input is not lost', () => {
    expect(wrapper.findComponent(Dialog).props('closeOnEscape')).toBe(false)
  })

  it('confirms a successful save with a toast', async () => {
    await click('Save')

    expect(toast.add).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'success',
        summary: 'Skills saved',
        detail: 'The skills of Max Muster were updated.',
      }),
    )
  })

  it('shows no toast when saving fails', async () => {
    vi.mocked(setSkills).mockRejectedValue(new Error('network'))

    await click('Save')

    expect(toast.add).not.toHaveBeenCalled()
  })

  describe('keyboard', () => {
    it('moves the focus to the row that follows a removed skill', async () => {
      await click('Remove Python (py)')

      expect(document.activeElement?.getAttribute('aria-label')).toBe('Remove Docker')
    })

    it('moves the focus to the row before when the last skill is removed', async () => {
      await click('Remove Docker')

      expect(document.activeElement?.getAttribute('aria-label')).toBe('Remove Python (py)')
    })

    it('moves the focus to "Add skill" when no skill is left', async () => {
      await click('Remove Python (py)')
      await click('Remove Docker')

      expect(document.activeElement?.id).toBe('skills-dialog-add')
    })
  })
})
