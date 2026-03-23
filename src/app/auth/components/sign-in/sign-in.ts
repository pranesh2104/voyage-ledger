import { Component, inject, signal } from '@angular/core';

import { Router, RouterModule } from '@angular/router';
import { form, required, minLength, email, pattern, FormField, submit } from '@angular/forms/signals';
import { AuthService } from '../../services/auth';
import { lastValueFrom } from 'rxjs';
import { ErrorInterface } from 'voyage-lib';
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
    pattern(login.password, /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}/, { message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character' });
  });

  private authService = inject(AuthService);

  private router = inject(Router);
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
        const result:any = await lastValueFrom(this.authService.login(form.email().value(), form.password().value()));
        console.log('Login successful', result);
        
        // Save access_token to cookie if it exists in response
        if (result?.['data'].session.access_token) {
          this.setCookie('access_token', result?.['data'].session.access_token, 7); // 7 days expiry
        }
      } catch (error: unknown) {
        const err = ((error as any).error) as ErrorInterface;
        console.error('Login failed', error);
        if (err.code === 'EMAIL_NOT_CONFIRMED') {
          this.router.navigate(['/auth/confirm-email'], { queryParams: { email: form.email().value() } });
        }
        return;
      }
      this.router.navigate(['/dashboard']);
      return undefined;
    });
  }

  /**
   * Helper method to set cookie
   */
  private setCookie(name: string, value: string, days: number): void {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Strict`;
  }
}
