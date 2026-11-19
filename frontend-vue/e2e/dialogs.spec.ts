import { expect, test, type Page, type Route } from '@playwright/test'

const skills = [
  { id: 's1', name: 'Python', alias: 'py', description: null },
  { id: 's2', name: 'Docker', alias: null, description: null },
  { id: 's3', name: 'Kotlin', alias: null, description: null },
]

const employees = [
  {
    id: 'e1',
    firstname: 'Max',
    lastname: 'Muster',
    email: 'max.muster@example.com',
    age: 34,
    skills: [{ skill_id: 's1', name: 'Python', alias: 'py', proficiency_level: 4, matched: false }],
  },
  {
    id: 'e2',
    firstname: 'Anna',
    lastname: 'Schmidt',
    email: 'anna.schmidt@example.com',
    age: 29,
    skills: [],
  },
]

/** Mocks the backend; returns the bodies of the write requests. */
async function mockBackend(page: Page) {
  const writes: { method: string; url: string; body: unknown }[] = []
  const record = (route: Route) =>
    writes.push({
      method: route.request().method(),
      url: new URL(route.request().url()).pathname + new URL(route.request().url()).search,
      body: route.request().postDataJSON?.() ?? null,
    })

  await page.route(/\/api\/employees(\?|$)/, (route) => route.fulfill({ json: employees }))
  await page.route(/\/api\/skills(\?|$)/, (route) => {
    const q = (new URL(route.request().url()).searchParams.get('q') ?? '').toLowerCase()
    return route.fulfill({ json: skills.filter((s) => s.name.toLowerCase().includes(q)) })
  })
  await page.route(/\/api\/employees\/[^/]+\/skills$/, (route) => {
    record(route)
    return route.fulfill({ json: employees[0] })
  })
  await page.route(/\/api\/skill-assignments\/bulk/, (route) => {
    record(route)
    return route.fulfill({ json: { created: ['e2'], updated: [], skipped: ['e1'] } })
  })
  return writes
}

test('manages the skills of one employee', async ({ page }) => {
  const writes = await mockBackend(page)
  await page.goto('/')

  await page.getByRole('button', { name: 'Manage skills of Max Muster' }).click()
  const dialog = page.getByRole('dialog', { name: 'Skills of Max Muster' })
  await expect(dialog).toBeVisible()

  await dialog.getByRole('combobox', { name: 'Add skill' }).fill('kot')
  await page.getByRole('option', { name: 'Kotlin' }).click()
  await dialog.getByRole('combobox', { name: 'Level of Kotlin' }).click()
  await page.getByRole('option', { name: '3 - Intermediate' }).click()
  await dialog.getByRole('button', { name: 'Save' }).click()

  await expect(dialog).toBeHidden()
  await expect(page.getByText('Skills saved')).toBeVisible()
  expect(writes).toEqual([
    {
      method: 'PUT',
      url: '/api/employees/e1/skills',
      body: {
        skills: [
          { skill_id: 's1', proficiency_level: 4 },
          { skill_id: 's3', proficiency_level: 3 },
        ],
      },
    },
  ])
})

test('assigns one skill to the selected employees and warns about existing levels', async ({
  page,
}) => {
  const writes = await mockBackend(page)
  await page.goto('/')
  const rows = page.locator('tbody tr[data-p-index]')
  await rows.nth(0).getByRole('checkbox').check()
  await rows.nth(1).getByRole('checkbox').check()

  await page.getByRole('button', { name: 'Assign skill (2)' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Assign skill' })
  await dialog.getByRole('combobox', { name: 'Skill' }).fill('py')
  await page.getByRole('option', { name: 'Python (py)' }).click()

  await expect(dialog.getByText('1 of the selected employees already has this skill')).toBeVisible()
  await expect(dialog.getByText('Max Muster: level 4')).toBeVisible()
  await expect(dialog.getByRole('combobox', { name: 'Level' })).toBeFocused()
  await page.keyboard.press('Enter')
  await page.getByRole('option', { name: '5 - Expert' }).click()
  await dialog.getByRole('button', { name: 'Keep existing levels' }).click()

  await expect(dialog).toBeHidden()
  await expect(page.getByText('Python assigned')).toBeVisible()
  expect(writes).toEqual([
    {
      method: 'POST',
      url: '/api/skill-assignments/bulk',
      body: { employee_ids: ['e1', 'e2'], skill_id: 's1', proficiency_level: 5 },
    },
  ])
})

test('imports a CSV file and lists the rows that failed', async ({ page }) => {
  await mockBackend(page)
  let uploaded = ''
  await page.route(/\/api\/employees\/import$/, (route) => {
    uploaded = route.request().postData() ?? ''
    return route.fulfill({
      json: {
        imported_count: 1,
        failed_count: 1,
        imported: [],
        errors: [{ line: 3, message: 'Age must be a number' }],
      },
    })
  })
  await page.goto('/')

  await page.getByRole('button', { name: 'Import CSV' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Import employees' })
  await dialog.locator('input[type=file]').setInputFiles({
    name: 'staff.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Lastname,Firstname,E-Mail,Age\nMuster,Max,max@example.com,34\n'),
  })

  await expect(dialog.getByText('1 of 2 rows imported')).toBeVisible()
  await expect(dialog.getByText('Line 3: Age must be a number')).toBeVisible()
  await expect(page.getByText('Import incomplete')).toBeVisible()
  expect(uploaded).toContain('filename="staff.csv"')

  await dialog.locator('.p-dialog-footer').getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
})

test('adds a skill from the catalog to the search', async ({ page }) => {
  await mockBackend(page)
  await page.goto('/')

  await page.getByRole('combobox', { name: 'Add a skill to the search' }).fill('dock')
  await page.getByRole('option', { name: 'Docker' }).click()

  await expect(page).toHaveURL(/\?skills=Docker$/)
  await expect(page.getByRole('list', { name: 'Skills in the search' })).toContainText('Docker')
})
