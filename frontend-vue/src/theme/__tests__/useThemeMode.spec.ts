import { matchMediaStub } from '@/__tests__/setup'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DARK_MODE_CLASS,
  initThemeMode,
  THEME_MODE_STORAGE_KEY,
  useThemeMode,
} from '../useThemeMode'

function isDarkApplied(): boolean {
  return document.documentElement.classList.contains(DARK_MODE_CLASS)
}

/** Lets the operating system prefer the dark or the light color scheme. */
function preferDark(dark: boolean): void {
  vi.stubGlobal('matchMedia', matchMediaStub(dark))
}

describe('useThemeMode', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove(DARK_MODE_CLASS)
  })

  afterEach(() => vi.unstubAllGlobals())

  it('follows the operating system when the user has not chosen a mode', () => {
    preferDark(true)

    initThemeMode()

    expect(isDarkApplied()).toBe(true)
    expect(useThemeMode().isDark.value).toBe(true)
  })

  it('switches to dark and back and remembers the choice', () => {
    preferDark(false)
    initThemeMode()
    const { isDark, toggle } = useThemeMode()
    expect(isDarkApplied()).toBe(false)

    toggle()
    expect(isDarkApplied()).toBe(true)
    expect(isDark.value).toBe(true)
    expect(localStorage.getItem(THEME_MODE_STORAGE_KEY)).toBe('dark')

    toggle()
    expect(isDarkApplied()).toBe(false)
    expect(isDark.value).toBe(false)
    expect(localStorage.getItem(THEME_MODE_STORAGE_KEY)).toBe('light')
  })

  it('prefers the stored choice over the operating system on the next start', () => {
    preferDark(false)
    localStorage.setItem(THEME_MODE_STORAGE_KEY, 'dark')

    initThemeMode()

    expect(isDarkApplied()).toBe(true)
  })

  it('ignores an unknown stored value', () => {
    preferDark(false)
    localStorage.setItem(THEME_MODE_STORAGE_KEY, 'purple')

    initThemeMode()

    expect(isDarkApplied()).toBe(false)
  })
})
