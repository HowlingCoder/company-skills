import { flushPromises, type VueWrapper } from '@vue/test-utils'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError } from '@/api/http'
import { type Employee, type Skill } from '@/api/models'
import { bulkAssign } from '@/api/skill-assignment-api'
import SkillPicker from '@/skills/SkillPicker.vue'
import AssignSkillDialog from '../AssignSkillDialog.vue'
import { dialog, dialogButton, footerButtons, mountDialog } from './dialog-helpers'

const toast = { add: vi.fn<(message: object) => void>() }
vi.mock('primevue/usetoast', () => ({ useToast: () => toast }))
vi.mock('@/api/skill-assignment-api')
vi.mock('@/api/skill-api', () => ({
  listSkills: vi.fn<() => Promise<unknown[]>>().mockResolvedValue([]),
}))

const python: Skill = { id: 's1', name: 'Python', alias: 'py', description: null }
const docker: Skill = { id: 's2', name: 'Docker', alias: null, description: null }

const employees: Employee[] = [
  {
    id: 'e1',
    firstname: 'Max',
    lastname: 'Muster',
    email: 'max@example.com',
    age: 34,
    skills: [{ skill_id: 's1', name: 'Python', alias: 'py', proficiency_level: 4, matched: false }],
  },
  {
    id: 'e2',
    firstname: 'Anna',
    lastname: 'Schmidt',
    email: 'anna@example.com',
    age: 29,
    skills: [],
  },
  {
    id: 'e3',
    firstname: 'Ida',
    lastname: 'Zimmer',
    email: 'ida@example.com',
    age: 41,
    skills: [{ skill_id: 's1', name: 'Python', alias: 'py', proficiency_level: 2, matched: false }],
  },
]

let wrapper: VueWrapper

async function pick(skill: Skill): Promise<void> {
  wrapper.findComponent(SkillPicker).vm.$emit('skillSelected', skill)
  await flushPromises()
}

async function chooseLevel(level: number): Promise<void> {
  wrapper.findComponent(Select).vm.$emit('update:modelValue', level)
  await flushPromises()
}

async function click(label: string): Promise<void> {
  dialogButton(label)!.click()
  await flushPromises()
}

function conflictRows(): string[] {
  return Array.from(
    dialog().querySelectorAll('ul[aria-label="Employees who already have this skill"] li'),
  ).map((row) => row.textContent?.trim() ?? '')
}

async function render(selected = employees): Promise<void> {
  wrapper = mountDialog(AssignSkillDialog, { employees: selected })
  await flushPromises()
}

describe('AssignSkillDialog', () => {
  beforeEach(() => {
    vi.mocked(bulkAssign)
      .mockReset()
      .mockResolvedValue({ created: ['e2'], updated: [], skipped: ['e1', 'e3'] })
    toast.add.mockReset()
  })

  afterEach(() => wrapper.unmount())

  it('lists the selected employees', async () => {
    await render()

    expect(dialog().textContent).toContain('Selected employees (3)')
    const names = Array.from(
      dialog().querySelectorAll('ul[aria-labelledby="assign-skill-employees"] li'),
    ).map((li) => li.textContent?.trim())
    expect(names).toEqual(['Max Muster', 'Anna Schmidt', 'Ida Zimmer'])
  })

  it('links the labels to the skill and the level field', async () => {
    await render()

    expect(dialog().querySelector('label[for="assign-skill-skill"]')?.textContent).toBe('Skill')
    expect(dialog().querySelector('input#assign-skill-skill')).not.toBeNull()
    expect(wrapper.findComponent(Select).props('ariaLabelledby')).toBe('assign-skill-level-label')
    expect(dialog().querySelector('#assign-skill-level-label')?.textContent).toBe('Level')
  })

  it('blocks assigning until a skill and a level are chosen', async () => {
    await render()
    expect(dialogButton('Assign')!.disabled).toBe(true)

    await pick(docker)
    expect(dialogButton('Assign')!.disabled).toBe(true)

    await chooseLevel(3)
    expect(dialogButton('Assign')!.disabled).toBe(false)
  })

  it('offers a single Assign button without conflicts and sends all employees', async () => {
    await render()
    await pick(docker)
    await chooseLevel(3)

    expect(footerButtons()).toEqual(['Cancel', 'Assign'])
    await click('Assign')

    expect(bulkAssign).toHaveBeenCalledWith(
      { employee_ids: ['e1', 'e2', 'e3'], skill_id: 's2', proficiency_level: 3 },
      false,
    )
    expect(wrapper.emitted('assigned')).toHaveLength(1)
  })

  it('shows who already has the skill and with which level', async () => {
    await render()

    await pick(python)

    expect(dialog().textContent).toContain('2 of the selected employees already have this skill')
    expect(conflictRows()).toEqual(['Max Muster: level 4', 'Ida Zimmer: level 2'])
    expect(footerButtons()).toEqual(['Cancel', 'Overwrite levels', 'Keep existing levels'])
  })

  it('words the warning for a single employee who already has the skill', async () => {
    await render(employees.slice(0, 2))

    await pick(python)

    expect(dialog().textContent).toContain('1 of the selected employees already has this skill')
  })

  it('keeps existing levels by default: no overwrite is sent', async () => {
    await render()
    await pick(python)
    await chooseLevel(5)

    await click('Keep existing levels')

    expect(bulkAssign).toHaveBeenCalledWith(expect.objectContaining({ skill_id: 's1' }), false)
  })

  it('overwrites existing levels only when asked explicitly', async () => {
    await render()
    await pick(python)
    await chooseLevel(5)

    await click('Overwrite levels')

    expect(bulkAssign).toHaveBeenCalledWith(expect.objectContaining({ proficiency_level: 5 }), true)
  })

  it('reports what the backend did, even if nothing changed', async () => {
    vi.mocked(bulkAssign).mockResolvedValue({ created: [], updated: [], skipped: ['e1', 'e3'] })
    await render()
    await pick(python)
    await chooseLevel(5)

    await click('Keep existing levels')

    expect(toast.add).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'info',
        summary: 'Nothing changed',
        detail: '0 assigned, 0 updated, 2 skipped.',
      }),
    )
  })

  it('confirms a change with the name of the skill', async () => {
    await render()
    await pick(docker)
    await chooseLevel(3)

    await click('Assign')

    expect(toast.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: 'Docker assigned' }),
    )
  })

  it('lets the user change the chosen skill', async () => {
    await render()
    await pick(python)
    expect(dialog().textContent).toContain('Python (py)')

    await click('Change')

    expect(dialog().querySelector('input#assign-skill-skill')).not.toBeNull()
    expect(conflictRows()).toEqual([])
  })

  it('shows the reason from the backend and stays open when an employee no longer exists', async () => {
    vi.mocked(bulkAssign).mockRejectedValue(new HttpError('x', 404, 'Employee e2 not found'))
    await render()
    await pick(docker)
    await chooseLevel(3)

    await click('Assign')

    expect(dialog().textContent).toContain('Skill could not be assigned')
    expect(dialog().textContent).toContain('Employee e2 not found')
    expect(wrapper.emitted('assigned')).toBeUndefined()
    expect(toast.add).not.toHaveBeenCalled()
  })

  it('shows a generic message when the server fails', async () => {
    vi.mocked(bulkAssign).mockRejectedValue(new HttpError('x', 500, undefined))
    await render()
    await pick(docker)
    await chooseLevel(3)

    await click('Assign')

    expect(dialog().textContent).toContain('The server did not answer as expected.')
  })

  it('keeps the dialog open on Escape, so a choice is not lost', async () => {
    await render()

    expect(wrapper.findComponent(Dialog).props('closeOnEscape')).toBe(false)
  })

  describe('keyboard', () => {
    it('moves the focus to the level once a skill is picked', async () => {
      await render()

      await pick(docker)

      expect(document.activeElement?.closest('#assign-skill-level')).not.toBeNull()
    })

    it('moves the focus back to the skill input on "Change"', async () => {
      await render()
      await pick(docker)

      await click('Change')

      expect(document.activeElement?.id).toBe('assign-skill-skill')
    })
  })
})
