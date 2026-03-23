import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ThemeToggleComponent } from '../shared/components/theme-toggle/theme-toggle.component';
import { AuthService } from '../auth/services/auth';
import { TripDialogService } from '../services/trip-dialog.service';
import { TripFormDialogComponent } from '../trip-form/trip-form-dialog.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, ThemeToggleComponent, TripFormDialogComponent],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss'],
})
export class LayoutComponent {
  isSidebarExpanded = signal(true);

  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  readonly tripDialogService = inject(TripDialogService);

  toggleSidebar(): void {
    this.isSidebarExpanded.update((v) => !v);
  }

  signOut(): void {
    this.authService.logout().subscribe({
      complete: () => this.router.navigate(['/auth/signin']),
      error: () => this.router.navigate(['/auth/signin']),
    });
  }
}
