import { Component, DestroyRef, inject, OnInit } from '@angular/core';

import { Router, RouterModule } from '@angular/router';
import { catchError, of } from 'rxjs';
import { AuthService } from '../auth/services/auth';
import { ThemeToggleComponent } from '../shared/components/theme-toggle/theme-toggle.component';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterModule, ThemeToggleComponent],
  templateUrl: './landing.html',
})
export class LandingPage implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  private destroyRef = inject(DestroyRef);

  ngOnInit() {
    this.authService.getCurrentUser().pipe(
      catchError(() => of(null)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((response) => {
      if (response) {
        this.authService.setCurrentUser(response.data.user);
        this.router.navigate(['/dashboard']);
      }
    });
  }
}
