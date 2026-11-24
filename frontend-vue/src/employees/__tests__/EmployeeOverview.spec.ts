import { DOMWrapper, flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Select from 'primevue/select'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listEmployees } from '@/api/employee-api'
import { type Employee } from '@/api/models'
import { employees } from '@/__tests__/fixtures'
import AssignSkillDialog from '../AssignSkillDialog.vue'
import EmployeeOverview from '../EmployeeOverview.vue'
import ImportDialog from '../ImportDialog.vue'
import SkillsDialog from '../SkillsDialog.vue'

vi.mock('@/api/employee-api')
vi.mock('@/api/skill-api', () => ({
  listSkills: vi.fn<() => Promise<unknown[]>>().mockResolvedValue([]),
}))
vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: vi.fn<(message: object) => void>() }),
}))

let wrapper: VueWrapper

/** Mounts the overview; the first request answers with `body`. */
async function mountWith(body: Employee[]): Promise<void> {
  vi.mocked(listEmployees).mockResolvedValueOnce(body)
  wrapper = mount(EmployeeOverview, {
    global: {
      plugins: [createPinia(), [PrimeVue, { theme: 'none' }]],
      stubs: { ImportDialog: true, AssignSkillDialog: true, SkillsDialog: true },
    },
  })
  await flushPromises()
}

function rows(): DOMWrapper<HTMLTableRowElement>[] {
  return wrapper.findAll<HTMLTableRowElement>('tbody tr[data-p-index]')
}

function buttons(label: string): DOMWrapper<HTMLButtonElement>[] {
  return wrapper
    .findAll<HTMLButtonElement>('button')
    .filter((button) => button.text().startsWith(label))
}

function assignButton(): DOMWrapper<HTMLButtonElement> {
  return buttons('Assign skill')[0]!
}

async function tickRow(index: number): Promise<void> {
  await rows()[index]!.find('input[type=checkbox]').trigger('change')
  await flushPromises()
}

describe('EmployeeOverview', () => {
  beforeEach(() => {
    vi.mocked(listEmployees).mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows a spinner while the employees are loading', async () => {
    let answer!: (body: Employee[]) => void
    vi.mocked(listEmployees).mockReturnValueOnce(new Promise((resolve) => (answer = resolve)))
    wrapper = mount(EmployeeOverview, {
      global: { plugins: [createPinia(), [PrimeVue, { theme: 'none' }]] },
    })
    await flushPromises()

    expect(wrapper.find('[aria-label="Loading employees"]').exists()).toBe(true)
    expect(wrapper.find('table').exists()).toBe(false)

    answer([])
    await flushPromises()
    expect(wrapper.find('[aria-label="Loading employees"]').exists()).toBe(false)
  })

  it('explains the wait when the first load takes longer than 3 seconds', async () => {
    vi.useFakeTimers()
    let answer!: (body: Employee[]) => void
    vi.mocked(listEmployees).mockReturnValueOnce(new Promise((resolve) => (answer = resolve)))
    wrapper = mount(EmployeeOverview, {
      global: { plugins: [createPinia(), [PrimeVue, { theme: 'none' }]] },
    })
    const hint = () => wrapper.find('.spinner p[role="status"]')

    await vi.advanceTimersByTimeAsync(2_900)
    expect(hint().exists()).toBe(false)
    await vi.advanceTimersByTimeAsync(200)
    expect(hint().text()).toContain('This can take about a minute')

    answer([])
    await flushPromises()
    expect(hint().exists()).toBe(false)
  })

  it('loads the employees once when it is shown', async () => {
    await mountWith(employees)

    expect(listEmployees).toHaveBeenCalledOnce()
  })

  it('lists every employee with name, email, age and skill badges', async () => {
    await mountWith(employees)

    expect(rows()).toHaveLength(2)
    expect(rows()[0]!.text()).toContain('Max Muster')
    expect(rows()[0]!.text()).toContain('max.muster@example.com')
    expect(rows()[0]!.text()).toContain('34')
    const badges = rows()[0]!
      .findAll('.skill-badge')
      .map((badge) => badge.text())
    expect(badges).toEqual(['Python 5', 'Docker 2'])
    expect(rows()[1]!.text()).toContain('Anna Schmidt')
    expect(rows()[1]!.findAll('.skill-badge')).toHaveLength(0)
  })

  it('shows the empty state when there are no employees', async () => {
    await mountWith([])

    expect(rows()).toHaveLength(0)
    expect(wrapper.text()).toContain('No employees yet')
    expect(wrapper.text()).toContain('Import a CSV file to add employees.')
  })

  it('offers the import in the empty state too', async () => {
    await mountWith([])

    expect(buttons('Import CSV')).toHaveLength(2)
  })

  it('shows an error with a retry action when loading fails, and reloads on retry', async () => {
    vi.mocked(listEmployees).mockRejectedValueOnce(new Error('GET /api/employees failed: 500'))
    wrapper = mount(EmployeeOverview, {
      global: { plugins: [createPinia(), [PrimeVue, { theme: 'none' }]] },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Employees could not be loaded')
    expect(wrapper.find('table').exists()).toBe(false)

    vi.mocked(listEmployees).mockResolvedValueOnce(employees)
    await buttons('Retry')[0]!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).not.toContain('Employees could not be loaded')
    expect(rows()).toHaveLength(2)
  })

  it('names the skills button of every row after the employee', async () => {
    await mountWith(employees)

    expect(wrapper.find('button[aria-label="Manage skills of Anna Schmidt"]').exists()).toBe(true)
  })

  it('enables "Assign skill" only with a selection and shows the number of rows', async () => {
    await mountWith(employees)
    expect(assignButton().element.disabled).toBe(true)
    expect(assignButton().text()).toBe('Assign skill')

    await tickRow(0)
    await tickRow(1)

    expect(assignButton().element.disabled).toBe(false)
    expect(assignButton().text()).toBe('Assign skill (2)')
  })

  it('tells why "Assign skill" is disabled until rows are selected', async () => {
    await mountWith(employees)
    expect(assignButton().attributes('title')).toBe('Select employees in the table first')

    await tickRow(0)

    expect(assignButton().attributes('title')).toBeUndefined()
  })

  it('names the employee on every row checkbox', async () => {
    await mountWith(employees)

    const labels = rows().map((row) => row.find('input[type=checkbox]').attributes('aria-label'))
    expect(labels).toEqual(['Select Max Muster', 'Select Anna Schmidt'])
    expect(wrapper.find('thead input[type=checkbox]').attributes('aria-label')).toBe(
      'Select all employees',
    )
  })

  it('selects and clears all rows with the header checkbox', async () => {
    await mountWith(employees)
    const selectAll = wrapper.find('thead input[type=checkbox]')

    await selectAll.trigger('change')
    expect(assignButton().text()).toBe('Assign skill (2)')

    await selectAll.trigger('change')
    expect(assignButton().text()).toBe('Assign skill')
  })

  it('offers "Assign skill" again after the table while rows are selected', async () => {
    await mountWith(employees)
    expect(buttons('Assign skill')).toHaveLength(1)

    await tickRow(1)

    expect(buttons('Assign skill')).toHaveLength(2)
    const afterTable = buttons('Assign skill')[1]!
    expect(afterTable.text()).toBe('Assign skill (1)')
    expect(
      wrapper.find('table').element.compareDocumentPosition(afterTable.element) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  describe('sorting by name', () => {
    function nameHeader(): DOMWrapper<HTMLElement> {
      return wrapper
        .findAll<HTMLElement>('thead th')
        .find((header) => header.text().startsWith('Name'))!
    }

    function names(): string[] {
      return rows().map((row) => row.findAll('td')[1]!.text())
    }

    it('marks the name column as sorted from the start', async () => {
      await mountWith(employees)

      expect(nameHeader().attributes('aria-sort')).toBe('ascending')
      expect(names()).toEqual(['Max Muster', 'Anna Schmidt'])
    })

    it('sorts by last name, not by the first name shown first', async () => {
      await mountWith(employees)

      await nameHeader().trigger('click')

      expect(nameHeader().attributes('aria-sort')).toBe('descending')
      expect(names()).toEqual(['Anna Schmidt', 'Max Muster'])
    })
  })

  describe('search', () => {
    const matching: Employee[] = [
      {
        ...employees[0]!,
        skills: [
          { skill_id: 's1', name: 'Python', alias: 'py', proficiency_level: 5, matched: true },
          { skill_id: 's2', name: 'Docker', alias: null, proficiency_level: 2, matched: false },
        ],
      },
    ]

    afterEach(() => {
      wrapper.unmount()
      window.history.replaceState(null, '', '/')
    })

    /** Opens the overview with the given query string; the first request answers with `body`. */
    async function openWith(query: string, body: Employee[]): Promise<void> {
      window.history.replaceState(null, '', `/${query}`)
      await mountWith(body)
    }

    /** Filter of the most recent request. */
    function lastRequest() {
      return vi.mocked(listEmployees).mock.lastCall?.[0]
    }

    function queryInput(): DOMWrapper<HTMLInputElement> {
      return wrapper.find<HTMLInputElement>('input[aria-label="Filter by name or email"]')
    }

    function pills(): string[] {
      return wrapper.findAll('ul[aria-label="Skills in the search"] li').map((li) => li.text())
    }

    it('loads with the filters of the URL and shows them in the filter bar', async () => {
      await openWith('?q=mus&skills=python&skills=k8s&skill_match=or&min_level=3', matching)

      expect(lastRequest()).toEqual({
        q: 'mus',
        skills: ['python', 'k8s'],
        skillMatch: 'or',
        minLevel: 3,
      })
      expect(queryInput().element.value).toBe('mus')
      expect(pills()).toEqual(['python', 'k8s'])
      expect(wrapper.find('[aria-label="Combine skills with"]').text()).toContain('Any skill')
      expect(wrapper.findComponent(Select).props('modelValue')).toBe(3)
    })

    it('searches by name or email after a short typing pause and puts q in the URL', async () => {
      await mountWith(employees)
      vi.mocked(listEmployees).mockResolvedValue(matching)

      await queryInput().setValue('mus')
      expect(listEmployees).toHaveBeenCalledTimes(1)

      // longer than the debounce of the search field
      await new Promise((resolve) => setTimeout(resolve, 350))
      await flushPromises()

      expect(listEmployees).toHaveBeenCalledTimes(2)
      expect(lastRequest()?.q).toBe('mus')
      expect(window.location.search).toBe('?q=mus')
    })

    it('drops URL values the backend would reject', async () => {
      await openWith('?min_level=9&skill_match=maybe&skills=%20&q=%20max%20', employees)

      expect(lastRequest()).toEqual({
        q: 'max',
        skills: [],
        skillMatch: undefined,
        minLevel: undefined,
      })
    })

    it('writes a chosen minimum level to the URL and searches with it', async () => {
      await mountWith(employees)
      vi.mocked(listEmployees).mockResolvedValue(matching)

      wrapper.findComponent(Select).vm.$emit('update:modelValue', 4)
      await flushPromises()

      expect(lastRequest()?.minLevel).toBe(4)
      expect(window.location.search).toBe('?min_level=4')
    })

    it('names every level in the minimum level selector', async () => {
      await mountWith(employees)

      const options = wrapper.findComponent(Select).props('options') as { label: string }[]
      expect(options.map((option) => option.label)).toEqual([
        'Any level',
        'Min. level 1 (Beginner)',
        'Min. level 2 (Basic)',
        'Min. level 3 (Intermediate)',
        'Min. level 4 (Advanced)',
        'Min. level 5 (Expert)',
      ])
    })

    it('adds a typed skill term with Enter, once only', async () => {
      await mountWith(employees)
      vi.mocked(listEmployees).mockResolvedValue(matching)
      const term = wrapper.find<HTMLInputElement>('input#employee-filter-skill')

      for (const value of ['kube*', 'KUBE*']) {
        await term.setValue(value)
        await term.trigger('keydown', { key: 'Enter', code: 'Enter' })
        await new Promise((resolve) => setTimeout(resolve))
        await flushPromises()
      }

      expect(pills()).toEqual(['kube*'])
      expect(term.element.value).toBe('')
      expect(window.location.search).toBe('?skills=kube*')
    })

    it('offers AND/OR only for several skills and sends OR when chosen', async () => {
      await openWith('?skills=python', matching)
      expect(wrapper.find('[aria-label="Combine skills with"]').exists()).toBe(false)
      wrapper.unmount()

      await openWith('?skills=python&skills=docker', matching)
      const anySkill = wrapper
        .findAll('[aria-label="Combine skills with"] button')
        .find((button) => button.text() === 'Any skill')!
      await anySkill.trigger('click')
      await flushPromises()

      expect(lastRequest()?.skillMatch).toBe('or')
      expect(window.location.search).toBe('?skills=python&skills=docker&skill_match=or')
    })

    it('removes a skill from the search when its pill is deleted', async () => {
      await openWith('?skills=python&skills=docker&skill_match=or', matching)

      await wrapper.find('button[aria-label="Remove python from the search"]').trigger('click')
      await flushPromises()

      // with one skill left, OR has no meaning any more
      expect(lastRequest()).toMatchObject({ skills: ['docker'], skillMatch: undefined })
      expect(window.location.search).toBe('?skills=docker')
    })

    it('keeps the table visible while a search is running', async () => {
      await mountWith(employees)
      let answer!: (body: Employee[]) => void
      vi.mocked(listEmployees).mockReturnValueOnce(new Promise((resolve) => (answer = resolve)))

      wrapper.findComponent(Select).vm.$emit('update:modelValue', 2)
      await flushPromises()

      expect(wrapper.find('[aria-label="Loading employees"]').exists()).toBe(false)
      expect(rows()).toHaveLength(2)
      answer(matching)
      await flushPromises()
      expect(rows()).toHaveLength(1)
    })

    it('marks the skills that match the search', async () => {
      await openWith('?skills=python', matching)

      const badges = wrapper.findAll('.skill-badge')
      expect(badges[0]!.classes()).toContain('skill-matched')
      expect(badges[0]!.text()).toContain('matches the search')
      expect(badges[1]!.classes()).not.toContain('skill-matched')
    })

    it('explains the wildcard when a skill search finds nobody', async () => {
      await openWith('?skills=kube', [])

      expect(wrapper.text()).toContain('e.g. kube*')
    })

    it('does not mention the wildcard when no skill is part of the search', async () => {
      await openWith('?q=nobody', [])

      expect(wrapper.text()).toContain('No employee fits the current filters.')
      expect(wrapper.text()).not.toContain('kube*')
    })

    it('offers to reset the filters when nothing matches, and clears URL and fields', async () => {
      await openWith('?q=nobody&min_level=5', [])
      expect(wrapper.text()).toContain('No employees match')
      expect(wrapper.text()).not.toContain('No employees yet')
      vi.mocked(listEmployees).mockResolvedValue(employees)

      await buttons('Reset filters')[0]!.trigger('click')
      await flushPromises()

      expect(lastRequest()).toEqual({
        q: '',
        skills: [],
        skillMatch: undefined,
        minLevel: undefined,
      })
      expect(window.location.search).toBe('')
      expect(queryInput().element.value).toBe('')
      expect(wrapper.findComponent(Select).props('modelValue')).toBe(0)
    })

    it('clears the selection when a new search starts', async () => {
      await mountWith(employees)
      await tickRow(0)
      expect(assignButton().text()).toBe('Assign skill (1)')

      wrapper.findComponent(Select).vm.$emit('update:modelValue', 3)
      await flushPromises()

      expect(assignButton().text()).toBe('Assign skill')
    })
  })

  describe('dialogs', () => {
    it('opens the import dialog from the button above the table', async () => {
      await mountWith(employees)
      expect(wrapper.findComponent(ImportDialog).exists()).toBe(false)

      await buttons('Import CSV')[0]!.trigger('click')

      expect(wrapper.findComponent(ImportDialog).exists()).toBe(true)
    })

    it('offers the import in the empty state too', async () => {
      await mountWith([])

      await buttons('Import CSV')[1]!.trigger('click')

      expect(wrapper.findComponent(ImportDialog).exists()).toBe(true)
    })

    it('reloads the table when the dialog reports an import, and closes it on close', async () => {
      await mountWith([])
      await buttons('Import CSV')[0]!.trigger('click')
      vi.mocked(listEmployees).mockResolvedValue(employees)

      wrapper.findComponent(ImportDialog).vm.$emit('imported')
      await flushPromises()

      expect(rows()).toHaveLength(2)
      expect(wrapper.findComponent(ImportDialog).exists()).toBe(true)
      wrapper.findComponent(ImportDialog).vm.$emit('close')
      await flushPromises()
      expect(wrapper.findComponent(ImportDialog).exists()).toBe(false)
    })

    it('opens the skills dialog for the employee of the clicked row', async () => {
      await mountWith(employees)

      await wrapper.find('button[aria-label="Manage skills of Anna Schmidt"]').trigger('click')

      expect(wrapper.findComponent(SkillsDialog).props('employee')).toMatchObject({ id: '2' })
    })

    it('reloads the table after skills were saved, but not after cancel', async () => {
      await mountWith(employees)
      const manage = () => wrapper.find('button[aria-label="Manage skills of Max Muster"]')
      vi.mocked(listEmployees).mockResolvedValue(employees)

      await manage().trigger('click')
      wrapper.findComponent(SkillsDialog).vm.$emit('close')
      await flushPromises()
      expect(listEmployees).toHaveBeenCalledTimes(1)
      expect(wrapper.findComponent(SkillsDialog).exists()).toBe(false)

      await manage().trigger('click')
      wrapper.findComponent(SkillsDialog).vm.$emit('saved')
      await flushPromises()
      expect(listEmployees).toHaveBeenCalledTimes(2)
      expect(wrapper.findComponent(SkillsDialog).exists()).toBe(false)
    })

    it('opens the assign dialog with the ticked employees', async () => {
      await mountWith(employees)
      await tickRow(1)

      await assignButton().trigger('click')

      expect(wrapper.findComponent(AssignSkillDialog).props('employees')).toEqual([employees[1]])
    })

    it('opens the assign dialog from the button after the table too', async () => {
      await mountWith(employees)
      await tickRow(0)

      await buttons('Assign skill')[1]!.trigger('click')

      expect(wrapper.findComponent(AssignSkillDialog).exists()).toBe(true)
    })

    it('reloads the table and clears the selection after a skill was assigned', async () => {
      await mountWith(employees)
      await tickRow(0)
      await assignButton().trigger('click')
      vi.mocked(listEmployees).mockResolvedValue(employees)

      wrapper.findComponent(AssignSkillDialog).vm.$emit('assigned')
      await flushPromises()

      expect(listEmployees).toHaveBeenCalledTimes(2)
      expect(wrapper.findComponent(AssignSkillDialog).exists()).toBe(false)
      expect(assignButton().element.disabled).toBe(true)
    })
  })
})
