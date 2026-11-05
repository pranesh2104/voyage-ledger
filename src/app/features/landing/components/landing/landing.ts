import { Component, DestroyRef, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { Router, RouterModule } from '@angular/router';
import { catchError, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ThemeToggleComponent } from '@shared/components/theme-toggle/theme-toggle.component';
import { AuthService } from '../../../auth/services/auth';
import { DemoService } from '@core/demo/demo.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterModule, ThemeToggleComponent],
  templateUrl: './landing.html',
})
export class LandingPage implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private demoService = inject(DemoService);

  private destroyRef = inject(DestroyRef);
  private platformId = inject(PLATFORM_ID);

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;

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

  startDemo(): void {
    this.demoService.start();
  }
}
