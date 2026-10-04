import { TestBed } from '@angular/core/testing';

import { THEME_STORAGE_KEY, ThemeService } from './theme.service';

describe('ThemeService', () => {
  const root = document.documentElement;

  beforeEach(() => {
    localStorage.clear();
    root.classList.remove('theme-light', 'theme-dark');
  });
  afterEach(() => {
    localStorage.clear();
    root.classList.remove('theme-light', 'theme-dark');
  });

  it('follows the system by default (no class forced on <html>)', () => {
    const theme = TestBed.inject(ThemeService);
    TestBed.tick();

    expect(theme.mode()).toBe('system');
    expect(root.classList.contains('theme-light') || root.classList.contains('theme-dark')).toBe(
      false,
    );
  });

  it('forces light or dark, remembers the choice and comes back to system', () => {
    const theme = TestBed.inject(ThemeService);

    theme.setMode('dark');
    TestBed.tick();
    expect(root.classList).toContain('theme-dark');
    expect(theme.isDark()).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    theme.setMode('light');
    TestBed.tick();
    expect(root.classList).toContain('theme-light');
    expect(root.classList).not.toContain('theme-dark');
    expect(theme.isDark()).toBe(false);

    theme.setMode('system');
    TestBed.tick();
    expect(root.classList).not.toContain('theme-light');
  });

  it('restores the saved choice', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    expect(TestBed.inject(ThemeService).mode()).toBe('dark');
  });
});
