
import { Component, inject, OnDestroy, OnInit, signal } from "@angular/core";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { AuthService } from "../../services/auth";
import { lastValueFrom, Subscription } from "rxjs";
import { SnackbarService } from "voyage-lib";

@Component({
  selector: 'app-verify',
  standalone: true,
  templateUrl: './verify.html',
  imports: [RouterModule]
})
export class Verify implements OnInit, OnDestroy {

  verifying = signal(true);
  error = signal<string | null>(null);
  email = signal<string>('');
  resending = signal(false);

  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private snackbarService = inject(SnackbarService);


  private subscription = new Subscription();

  ngOnInit(): void {
    // Read optional email query param
    this.subscription.add(this.route.queryParams.subscribe(params => {
      if (params['email']) {
        this.email.set(params['email']);
      }

      // Begin verification process
      const tokenHash = params['token_hash'];
      const type = params['type'];
      if (tokenHash && type) {
        this.subscription.add(this.authService.verifyToken(tokenHash, type).subscribe({
          next: (_: any) => {
            this.verifying.set(false);
            this.error.set(null);
            this.snackbarService.success('Verification successful! Redirecting...', { duration: 3000 });
            setTimeout(() => {
              if (type === 'recovery') {
                this.router.navigate(['/auth/reset-password']);
              } else {
                this.router.navigate(['/dashboard']);
              }
            }, 2000);
          },
          error: (err) => {
            this.verifying.set(false);
            if (err?.error?.code === 'OTP_EXPIRED') {
              this.error.set('The verification link has expired. Please request a new verification email.');
              this.snackbarService.error('Verification link expired. Please request a new one.', { duration: 5000 });
            } else {
              this.error.set('Verification failed. Please try again.');
              this.snackbarService.error('Verification failed. Please try again.', { duration: 4000 });
              setTimeout(() => {
                this.router.navigate(['/auth/signin']);
              }, 3000);
            }
          }
        }));
      }
    }));
  }

  async resendEmail(): Promise<void> {
    if (this.resending()) return;

    this.resending.set(true);

    try {
      await lastValueFrom(this.authService.resend(this.email()));
      this.snackbarService.success('Verification email sent! Please check your inbox.', { duration: 4000 });
      setTimeout(() => {
        this.router.navigate(['/auth/signin']);
      }, 3000);
    } catch (error) {
      this.snackbarService.error('Failed to resend verification email. Please try again.', { duration: 4000 });
    } finally {
      this.resending.set(false);
    }
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

}