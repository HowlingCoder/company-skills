import { expect, test, type Page } from '@playwright/test'

// The backend is mocked with page.route, so this flow needs only the Vite dev server.

const employees = [
  {
    id: '1',
    firstname: 'Max',
    lastname: 'Muster',
    email: 'max.muster@example.com',
    age: 34,
    skills: [
      { skill_id: 's1', name: 'Python', alias: 'py', proficiency_level: 5, matched: false },
      { skill_id: 's2', name: 'Docker', alias: null, proficiency_level: 4, matched: false },
      { skill_id: 's3', name: 'Angular', alias: null, proficiency_level: 3, matched: false },
      { skill_id: 's4', name: 'SQL', alias: null, proficiency_level: 2, matched: false },
      { skill_id: 's5', name: 'Go', alias: null, proficiency_level: 1, matched: false },
    ],
  },
  {
    id: '2',
    firstname: 'Anna',
    lastname: 'Schmidt',
    email: 'anna.schmidt@example.com',
    age: 29,
    skills: [],
  },
]

async function answerEmployees(page: Page, body: unknown, status = 200): Promise<void> {
  await page.route(/\/api\/employees(\?|$)/, (route) => route.fulfill({ status, json: body }))
}

test('lists the employees and selects rows for a bulk assignment', async ({ page }) => {
  await answerEmployees(page, employees)
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Company Skill Management' })).toBeVisible()
  const rows = page.locator('tbody tr[data-p-index]')
  await expect(rows).toHaveCount(2)
  await expect(rows.first()).toContainText('Max Muster')

  const assign = page.getByRole('button', { name: /^Assign skill/ })
  await expect(assign).toBeDisabled()

  await rows.nth(1).getByRole('checkbox').check()

  await expect(assign.first()).toHaveText('Assign skill (1)')
  await expect(assign.first()).toBeEnabled()
  await expect(page.getByText('1 selected')).toBeVisible()
})

test('shows hidden skills in a popover behind the +N badge', async ({ page }) => {
  await answerEmployees(page, employees)
  await page.goto('/')
  const firstRow = page.locator('tbody tr[data-p-index]').first()
  await expect(firstRow.locator('.skill-badge')).toHaveText([
    'Python 5',
    'Docker 4',
    'Angular 3',
    'SQL 2',
  ])

  await firstRow.getByRole('button', { name: 'Show 1 more skill' }).click()

  await expect(page.locator('.p-popover .skill-badge')).toHaveText(['Go 1'])
  await page.keyboard.press('Escape')
  await expect(page.locator('.p-popover')).toHaveCount(0)
})

test('shows the empty state without employees', async ({ page }) => {
  await answerEmployees(page, [])
  await page.goto('/')

  await expect(page.getByText('No employees yet')).toBeVisible()
})

test('shows an error and loads again on retry', async ({ page }) => {
  await answerEmployees(page, { detail: 'boom' }, 500)
  await page.goto('/')
  await expect(page.getByText('Employees could not be loaded')).toBeVisible()

  await page.unroute(/\/api\/employees(\?|$)/)
  await answerEmployees(page, employees)
  await page.getByRole('button', { name: 'Retry' }).click()

  await expect(page.locator('tbody tr[data-p-index]')).toHaveCount(2)
})

test('switches to dark mode and keeps it after a reload', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await answerEmployees(page, employees)
  await page.goto('/')
  const html = page.locator('html')
  await expect(html).not.toHaveClass(/app-dark/)

  await page.getByRole('button', { name: 'Switch to dark mode' }).click()
  await expect(html).toHaveClass(/app-dark/)

  await page.reload()
  await expect(html).toHaveClass(/app-dark/)
  await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible()
})

test('filters by skill and keeps the filter in the URL across a reload', async ({ page }) => {
  const requests: string[] = []
  await page.route(/\/api\/employees(\?|$)/, (route) => {
    requests.push(new URL(route.request().url()).search)
    return route.fulfill({ json: employees })
  })
  await page.route(/\/api\/skills(\?|$)/, (route) => route.fulfill({ json: [] }))
  await page.goto('/')
  await expect(page.locator('tbody tr[data-p-index]')).toHaveCount(2)

  const term = page.getByRole('combobox', { name: 'Add a skill to the search' })
  await term.fill('python')
  await term.press('Enter')
  await expect(page.getByRole('list', { name: 'Skills in the search' })).toContainText('python')
  await term.fill('docker')
  await term.press('Enter')
  await page.getByRole('button', { name: 'Any skill' }).click()

  await expect(page).toHaveURL(/\?skills=python&skills=docker&skill_match=or$/)
  await expect.poll(() => requests.at(-1)).toBe('?skills=python&skills=docker&skill_match=or')

  await page.reload()
  await expect(page.getByRole('list', { name: 'Skills in the search' })).toContainText('python')
  await expect.poll(() => requests.at(-1)).toBe('?skills=python&skills=docker&skill_match=or')
})
