
import { Component, inject } from '@angular/core';

import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [],
  template: `
    <button 
      (click)="themeService.toggleTheme()" 
      class="p-2 rounded-full bg-white/10 backdrop-blur-md border border-white/10 hover:bg-white/20 transition-all duration-300 group shadow-sm"
      aria-label="Toggle theme">
      
      <!-- Sun Icon (Show in Dark Mode) -->
      @if (themeService.isDarkMode()) {
      <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-yellow-400 group-hover:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
      }

      <!-- Moon Icon (Show in Light Mode) -->
      @if (!themeService.isDarkMode()) {
      <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-primary group-hover:-rotate-12 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
      }
    </button>
  `,
  styles: []
})
export class ThemeToggleComponent {
  themeService = inject(ThemeService);
}
