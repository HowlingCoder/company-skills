import { readonly, ref } from 'vue'

export const THEME_MODE_STORAGE_KEY = 'skill-management-theme'

/** Class on <html> that switches PrimeVue to dark (darkModeSelector in main.ts). */
export const DARK_MODE_CLASS = 'app-dark'

type StoredMode = 'light' | 'dark'

const isDark = ref(false)

function storedMode(): StoredMode | undefined {
  const value = localStorage.getItem(THEME_MODE_STORAGE_KEY)
  return value === 'light' || value === 'dark' ? value : undefined
}

function prefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

function apply(dark: boolean): void {
  isDark.value = dark
  document.documentElement.classList.toggle(DARK_MODE_CLASS, dark)
}

/** Applies the stored choice, or the preference of the operating system. Call once before mount. */
export function initThemeMode(): void {
  const stored = storedMode()
  apply(stored ? stored === 'dark' : prefersDark())
}

/** Light and dark mode: follows the operating system until the user picks one. */
export function useThemeMode() {
  function toggle(): void {
    const dark = !isDark.value
    localStorage.setItem(THEME_MODE_STORAGE_KEY, dark ? 'dark' : 'light')
    apply(dark)
  }

  return { isDark: readonly(isDark), toggle }
}
