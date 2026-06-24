import { Component, inject, signal } from '@angular/core';

import { Router, RouterModule } from '@angular/router';
import { form, required, minLength, email, pattern, FormField, submit } from '@angular/forms/signals';
import { AuthService } from '../../services/auth';
import { lastValueFrom } from 'rxjs';
import { ErrorInterface, SnackbarService } from 'voyage-lib';
import { PASSWORD_PATTERN } from '../../constants/auth.constant';
@Component({
  selector: 'app-sign-in',
  imports: [RouterModule, FormField],
  templateUrl: './sign-in.html',
  standalone: true
})
export class SignIn {
  /**
   * Show password toggle
   */
  showPassword = signal(false);
  /**
   * Login model
   */
  loginModel = signal({
    email: '',
    password: '',
    rememberMe: false
  });
  /**
   * Login form
   */
  logInForm = form(this.loginModel, (login) => {
    required(login.email, { message: 'Email is required' });
    email(login.email, { message: 'Please enter a valid email address' });
    required(login.password, { message: 'Password is required' });
    minLength(login.password, 8, { message: 'Password must be at least 8 characters long' });
    pattern(login.password, PASSWORD_PATTERN, { message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character' });
  });

  private authService = inject(AuthService);
  private router = inject(Router);
  private snackbarService = inject(SnackbarService);
  /**
   * Toggle password visibility
   */
  togglePasswordVisibility(): void {
    this.showPassword.update((value) => !value);
  }
  /**
   * Submit form
   */
  async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.logInForm, async (form) => {
      try {
        const result = await lastValueFrom(this.authService.login(form.email().value(), form.password().value()));
        this.authService.setCurrentUser(result.data.user);
      } catch (error: unknown) {
        const err = ((error as any).error) as ErrorInterface;
        if (err.code === 'EMAIL_NOT_CONFIRMED') {
          this.snackbarService.warning('Please verify your email before signing in.', { duration: 4000 });
          this.router.navigate(['/auth/confirm-email'], { queryParams: { email: form.email().value() } });
        } else {
          this.snackbarService.error(err.message || 'Sign in failed. Please check your credentials.', { duration: 4000 });
        }
        return;
      }
      this.router.navigate(['/dashboard']);
      return undefined;
    });
  }

}
