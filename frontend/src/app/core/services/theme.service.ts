import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';

export type ThemeMode = 'system' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'spm.theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * Light / dark theme. "system" follows the operating system; "light" and "dark" force it with a class
 * on <html> (styles.scss switches the Material color scheme). The choice is remembered in this browser.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly media = this.document.defaultView?.matchMedia?.(DARK_QUERY) ?? null;
  private readonly systemDark = signal(this.media?.matches ?? false);

  readonly mode = signal<ThemeMode>(this.read());
  /** The theme actually displayed. */
  readonly isDark = computed(
    () => this.mode() === 'dark' || (this.mode() === 'system' && this.systemDark()),
  );

  constructor() {
    this.media?.addEventListener?.('change', (event) => this.systemDark.set(event.matches));
    effect(() => {
      const root = this.document.documentElement;
      root.classList.toggle('theme-light', this.mode() === 'light');
      root.classList.toggle('theme-dark', this.mode() === 'dark');
    });
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
    try {
      this.document.defaultView?.localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // Storage unavailable (private browsing…): the choice lasts until the page is closed.
    }
  }

  private read(): ThemeMode {
    try {
      const saved = this.document.defaultView?.localStorage.getItem(THEME_STORAGE_KEY);
      return saved === 'light' || saved === 'dark' ? saved : 'system';
    } catch {
      return 'system';
    }
  }
}
