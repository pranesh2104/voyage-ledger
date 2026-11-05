import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../features/auth/services/auth';
import { DemoStore } from './demo-store.service';

/** Entering and leaving the demo: the buttons on the landing page, sign-in page and demo banner. */
@Injectable({ providedIn: 'root' })
export class DemoService {
  private readonly store = inject(DemoStore);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly active = this.store.active;

  start(): void {
    this.store.start();
    // A signed-in user's details may be cached; clear them so the guard loads the demo user.
    this.authService.setCurrentUser(null);
    this.router.navigate(['/dashboard']);
  }

  /** Back to the sample data the demo started with; reloads so every page shows it. */
  reset(): void {
    this.store.reset();
    window.location.reload();
  }

  exit(redirectTo: '/' | '/auth/signup' = '/'): void {
    this.store.end();
    this.authService.setCurrentUser(null);
    this.router.navigateByUrl(redirectTo);
  }
}
