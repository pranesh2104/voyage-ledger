import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { Router, RouterModule } from '@angular/router';
import { email, form, minLength, pattern, required, submit, validate, FormField } from '@angular/forms/signals';
import { AuthService } from '../../services/auth';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-sign-up',
  imports: [RouterModule, FormField],
  templateUrl: './sign-up.html',
  standalone: true
})
export class SignUp implements OnInit {
  /**
   * Whether the password is visible.
   */
  showPassword = signal(false);
  /**
   * Whether the confirm password is visible.
   */
  showConfirmPassword = signal(false);
  /**
   * The model for the sign up form.
   */
  signUpModel = signal({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false
  });
  /**
   * The form group for the sign up form.
   */
  signupForm = form(this.signUpModel, (signUpform) => {
    required(signUpform.fullName, { message: 'Full name is required' });
    minLength(signUpform.fullName, 5, { message: 'Full name must be at least 5 characters long' });
    required(signUpform.email, { message: 'Email is required' });
    email(signUpform.email, { message: 'Please enter a valid email address' });
    required(signUpform.password, { message: 'Password is required' });
    minLength(signUpform.password, 8, { message: 'Password must be at least 8 characters long' });
    pattern(signUpform.password, /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}/, { message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character' });
    required(signUpform.confirmPassword, { message: 'Confirm password is required' });
    minLength(signUpform.confirmPassword, 8, { message: 'Confirm password must be at least 8 characters long' });
    pattern(signUpform.confirmPassword, /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}/, { message: 'Confirm password must contain at least one uppercase letter, one lowercase letter, one number, and one special character' });
    required(signUpform.agreeToTerms, { message: 'You must agree to the terms and conditions' });
    validate(signUpform.confirmPassword, ({ value, valueOf }) => {
      if (value() !== valueOf(signUpform.password)) {
        return { kind: 'password-mismatch', message: 'Passwords are not identical' };
      }
      return undefined;
    });
  });
  /**
   * Gets the strength of the password.
   * @returns The strength of the password.
   */
  passwordStrength = computed<'weak' | 'medium' | 'strong' | ''>(() => {
    const password = this.signupForm.password().value() ?? '';

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

  private authService = inject(AuthService);

  private router = inject(Router);

  ngOnInit(): void {
    console.log();
  }
  /**
   * Toggles the visibility of the password field.
   * @returns void
   */
  togglePasswordVisibility(): void {
    this.showPassword.update((value) => !value);
  }
  /**
   * Toggles the visibility of the confirm password field.
   * @returns void
   */
  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.update((value) => !value);
  }

  async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    const response = await submit(this.signupForm, async (form) => {
      try {
        const result = await lastValueFrom(this.authService.signUp(
          form.fullName().value(),
          form.email().value(),
          form.password().value()
        ));
        console.log({ result });
        return undefined;
      } catch (error: any) {
        console.error('Sign up failed', error);
        if (error.error.code === 'EMAIL_EXISTS') {
          return [{
            kind: 'server',
            fieldTree: form.email,
            message: 'This email is already registered',
          }];
        }
        return [{
          kind: 'server',
          fieldTree: form,
          message: error.error.message || 'Sign up failed due to server error',
        }];
      }

    });
    if (this.signupForm().valid()) {
      this.router.navigate(['/auth/signin']);
    }
    console.log('form error', this.signupForm())
    console.log({ response });
  }
}
