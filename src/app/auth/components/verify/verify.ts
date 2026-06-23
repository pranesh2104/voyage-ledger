
import { Component, inject, OnDestroy, OnInit, signal } from "@angular/core";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { AuthService } from "../../services/auth";
import { lastValueFrom, Subscription } from "rxjs";

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
            } else {
              this.error.set('Verification failed. Please try again.');
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
      setTimeout(() => {
        this.router.navigate(['/auth/signin']);
      }, 3000);
    } catch (error) {
      console.error('Failed to resend email', error);
    } finally {
      this.resending.set(false);
    }
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

}