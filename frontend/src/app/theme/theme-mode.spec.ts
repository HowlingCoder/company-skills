import { TestBed } from '@angular/core/testing';
import { THEME_MODE_STORAGE_KEY, ThemeMode } from './theme-mode';

function isDarkApplied(): boolean {
  return document.documentElement.classList.contains('app--dark');
}

/** Lets the operating system prefer the dark or the light color scheme. */
function preferDark(dark: boolean): void {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        matches: dark,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
}

describe('ThemeMode', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('app--dark');
  });

  afterEach(() => vi.restoreAllMocks());

  it('follows the operating system when the user has not chosen a mode', () => {
    preferDark(true);
    const themeMode = TestBed.inject(ThemeMode);

    themeMode.init();

    expect(isDarkApplied()).toBe(true);
    expect(themeMode.isDark()).toBe(true);
  });

  it('switches to dark and back and remembers the choice', () => {
    preferDark(false);
    const themeMode = TestBed.inject(ThemeMode);
    themeMode.init();
    expect(isDarkApplied()).toBe(false);

    themeMode.toggle();
    expect(isDarkApplied()).toBe(true);
    expect(themeMode.isDark()).toBe(true);
    expect(localStorage.getItem(THEME_MODE_STORAGE_KEY)).toBe('dark');

    themeMode.toggle();
    expect(isDarkApplied()).toBe(false);
    expect(themeMode.isDark()).toBe(false);
    expect(localStorage.getItem(THEME_MODE_STORAGE_KEY)).toBe('light');
  });

  it('prefers the stored choice over the operating system on the next start', () => {
    preferDark(false);
    localStorage.setItem(THEME_MODE_STORAGE_KEY, 'dark');

    TestBed.inject(ThemeMode).init();

    expect(isDarkApplied()).toBe(true);
  });

  it('ignores an unknown stored value', () => {
    preferDark(false);
    localStorage.setItem(THEME_MODE_STORAGE_KEY, 'purple');

    TestBed.inject(ThemeMode).init();

    expect(isDarkApplied()).toBe(false);
  });
});
