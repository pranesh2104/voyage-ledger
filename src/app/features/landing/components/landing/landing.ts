import { afterNextRender, Component, DestroyRef, ElementRef, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { Router, RouterModule } from '@angular/router';
import { catchError, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ThemeToggleComponent } from '@shared/components/theme-toggle/theme-toggle.component';
import { AuthService } from '../../../auth/services/auth';
import { DemoService } from '@core/demo/demo.service';
import { revealOnScroll } from '../../utils/reveal-on-scroll.util';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterModule, ThemeToggleComponent],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
})
export class LandingPage implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private demoService = inject(DemoService);

  private destroyRef = inject(DestroyRef);
  private platformId = inject(PLATFORM_ID);
  private host: ElementRef<HTMLElement> = inject(ElementRef);

  constructor() {
    // Browser only: the prerendered HTML shows every section without waiting for JavaScript.
    afterNextRender(() => {
      const stop = revealOnScroll(this.host.nativeElement);
      this.destroyRef.onDestroy(stop);
    });
  }

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
