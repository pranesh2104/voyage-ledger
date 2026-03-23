import { Injectable, signal, effect, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private platformId = inject(PLATFORM_ID);

  // Signal to track current theme state
  isDarkMode = signal<boolean>(false);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      // Check localStorage or system preference on init
      const savedTheme = localStorage.getItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.isDarkMode.set(savedTheme === 'dark' || (!savedTheme && prefersDark));
    }

    // Effect to update DOM and localStorage when signal changes
    effect(() => {
      if (isPlatformBrowser(this.platformId)) {
        const isDark = this.isDarkMode();
        const html = document.documentElement;
        if (isDark) {
          html.classList.add('dark');
          localStorage.setItem('theme', 'dark');
        } else {
          html.classList.remove('dark');
          localStorage.setItem('theme', 'light');
        }
      }
    });
  }

  toggleTheme() {
    this.isDarkMode.update((prev) => !prev);
  }
}
