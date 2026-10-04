import { Injectable, inject } from '@angular/core';
import { SiThemeService, injectIsDarkTheme } from '@siemens/element-ng/theme';

export const THEME_MODE_STORAGE_KEY = 'skill-management-theme';

type StoredMode = 'light' | 'dark';

/** Light and dark mode: follows the operating system until the user picks one. */
@Injectable({ providedIn: 'root' })
export class ThemeMode {
  private readonly themeService = inject(SiThemeService);

  readonly isDark = injectIsDarkTheme();

  /** Applies the stored choice, or the preference of the operating system. */
  init(): void {
    this.themeService.applyThemeType(this.stored() ?? 'auto');
  }

  toggle(): void {
    const mode: StoredMode = this.isDark() ? 'light' : 'dark';
    localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
    this.themeService.applyThemeType(mode);
  }

  private stored(): StoredMode | undefined {
    const value = localStorage.getItem(THEME_MODE_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : undefined;
  }
}
