import { Component, HostListener, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AvatarComponent } from 'voyage-lib';
import { ThemeToggleComponent } from '@shared/components/theme-toggle/theme-toggle.component';
import { AuthService } from '../../../features/auth/services/auth';
import { TripDialogService } from '@core/services/trip-dialog.service';
import { TripFormDialogComponent } from '../../../features/trip-form/components/trip-form-dialog/trip-form-dialog.component';
import { MembersDialogComponent } from '../../../features/members/components/members-dialog/members-dialog.component';
import { DESKTOP_BREAKPOINT } from '../../constants/layout.constant';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, ThemeToggleComponent, TripFormDialogComponent, AvatarComponent, MembersDialogComponent],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss'],
})
export class LayoutComponent {
  isSidebarExpanded = signal(window.innerWidth >= DESKTOP_BREAKPOINT);
  isUserMenuOpen = signal(false);

  private readonly router = inject(Router);
  readonly authService = inject(AuthService);
  readonly tripDialogService = inject(TripDialogService);

  toggleSidebar(): void {
    this.isSidebarExpanded.update((v) => !v);
  }

  closeSidebarIfMobile(): void {
    if (window.innerWidth < DESKTOP_BREAKPOINT) {
      this.isSidebarExpanded.set(false);
    }
  }

  toggleUserMenu(): void {
    this.isUserMenuOpen.update((v) => !v);
  }

  @HostListener('document:click')
  closeUserMenu(): void {
    this.isUserMenuOpen.set(false);
  }

  signOut(): void {
    this.isUserMenuOpen.set(false);
    this.authService.logout().subscribe({
      complete: () => this.router.navigate(['/auth/signin']),
      error: () => this.router.navigate(['/auth/signin']),
    });
  }
}
