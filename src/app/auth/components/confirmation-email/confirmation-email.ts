import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';

import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth';
import { lastValueFrom, Subscription } from 'rxjs';

@Component({
  selector: 'app-confirmation-email',
  imports: [RouterModule],
  templateUrl: './confirmation-email.html',
  standalone: true
})
export class ConfirmationEmail implements OnInit, OnDestroy {
  email = signal<string>('');
  resending = signal(false);
  countdown = signal(0);

  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router)
  private countdownInterval?: ReturnType<typeof setInterval>;
  private subscription = new Subscription();

  ngOnInit(): void {
    this.subscription.add(this.route.queryParams.subscribe(params => {
      if (params['email']) {
        this.email.set(params['email']);
      }
      else {
        this.router.navigate(['/auth/signin']);
      }
    }));
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }

  async resendEmail(): Promise<void> {
    if (this.resending() || this.countdown() > 0) return;

    this.resending.set(true);

    try {
      await lastValueFrom(this.authService.resend(this.email()));
      console.log('Email resent successfully');
      this.startCountdown();
    } catch (error) {
      console.error('Failed to resend email', error);
    } finally {
      this.resending.set(false);
    }
  }

  private startCountdown(): void {
    this.countdown.set(60);

    this.countdownInterval = setInterval(() => {
      const currentCount = this.countdown();
      if (currentCount <= 1) {
        this.countdown.set(0);
        if (this.countdownInterval) {
          clearInterval(this.countdownInterval);
        }
      } else {
        this.countdown.set(currentCount - 1);
      }
    }, 1000);
  }
}
