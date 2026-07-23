import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { form, minLength, pattern, required, submit, validate, FormField } from '@angular/forms/signals';
import { AuthService } from '../../services/auth';
import { lastValueFrom } from 'rxjs';
import { PASSWORD_PATTERN } from '../../constants/auth.constant';
import { SnackbarService } from 'voyage-lib';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [RouterModule, FormField],
  templateUrl: './reset-password.html',
})
export class ResetPassword {

  private authService = inject(AuthService);
  private router = inject(Router);
  private snackbarService = inject(SnackbarService);

  showPassword = signal(false);
  showConfirmPassword = signal(false);
  isSuccess = signal(false);

  resetPasswordModel = signal({ password: '', confirmPassword: '' });

  resetPasswordForm = form(this.resetPasswordModel, (f) => {
    required(f.password, { message: 'Password is required' });
    minLength(f.password, 8, { message: 'Password must be at least 8 characters long' });
    pattern(f.password, PASSWORD_PATTERN, { message: 'Password must contain uppercase, lowercase, number, and special character' });
    required(f.confirmPassword, { message: 'Confirm password is required' });
    validate(f.confirmPassword, ({ value, valueOf }) => {
      if (value() !== valueOf(f.password)) {
        return { kind: 'password-mismatch', message: 'Passwords do not match' };
      }
      return undefined;
    });
  });

  passwordStrength = computed<'weak' | 'medium' | 'strong' | ''>(() => {
    const password = this.resetPasswordForm.password().value() ?? '';
    if (!password) return '';
    if (password.length < 8) return 'weak';
    let strength = 0;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength++;
    if (strength <= 2) return 'weak';
    if (strength === 3) return 'medium';
    return 'strong';
  });

  togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.update((v) => !v);
  }

  async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.resetPasswordForm, async (f) => {
      try {
        await lastValueFrom(this.authService.resetPassword(f.password().value()));
        this.isSuccess.set(true);
        this.snackbarService.success('Password reset successfully! Redirecting to sign in...', { duration: 3000 });
        setTimeout(() => this.router.navigate(['/auth/signin']), 2500);
        return undefined;
      } catch (error: any) {
        this.snackbarService.error(error?.error?.message || 'Failed to reset password. Please try again.', { duration: 4000 });
        return [{
          kind: 'server',
          fieldTree: this.resetPasswordForm,
          message: error?.error?.message || 'Failed to reset password. Please try again.',
        }];
      }
    });
  }
}
