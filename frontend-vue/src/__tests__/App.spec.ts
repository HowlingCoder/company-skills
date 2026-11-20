import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import { matchMediaStub } from '@/__tests__/setup'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listEmployees } from '@/api/employee-api'
import App from '../App.vue'
import { DARK_MODE_CLASS, initThemeMode } from '../theme/useThemeMode'

vi.mock('@/api/employee-api')

function mountApp() {
  return mount(App, { global: { plugins: [createPinia(), [PrimeVue, { theme: 'none' }]] } })
}

describe('App', () => {
  beforeEach(() => {
    vi.mocked(listEmployees).mockResolvedValue([])
    localStorage.clear()
    vi.stubGlobal('matchMedia', matchMediaStub(false))
    initThemeMode()
  })

  afterEach(() => {
    document.documentElement.classList.remove(DARK_MODE_CLASS)
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('renders the application name in the header', () => {
    const wrapper = mountApp()

    expect(wrapper.find('header h1').text()).toBe('Company Skill Management (Vue)')
  })

  it('shows the employee overview', async () => {
    const wrapper = mountApp()
    await flushPromises()

    expect(wrapper.find('main h2').text()).toBe('Employees')
  })

  it('switches between light and dark mode with the header button', async () => {
    const wrapper = mountApp()
    const toggle = wrapper.find('header button')
    expect(toggle.attributes('aria-label')).toBe('Switch to dark mode')

    await toggle.trigger('click')

    expect(document.documentElement.classList).toContain(DARK_MODE_CLASS)
    expect(toggle.attributes('aria-label')).toBe('Switch to light mode')
  })
})
