import { Component, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { email, form, FormField, required, submit } from '@angular/forms/signals';
import { AuthService } from '../../services/auth';
import { lastValueFrom } from 'rxjs';
import { SnackbarService } from 'voyage-lib';

@Component({
	selector: 'app-forgot-password',
	standalone: true,
	imports: [FormField, RouterModule],
	templateUrl: './forgot-password.html',
})
export class ForgotPassword {

	private authService = inject(AuthService);

	private snackBarService = inject(SnackbarService);

	forgotPasswordModel = signal({ email: '' });

	forgotPasswordForm = form(this.forgotPasswordModel, (forgotPasswordForm) => {
		required(forgotPasswordForm.email, { message: 'Email is required' });
		email(forgotPasswordForm.email, { message: 'Please enter a valid email address' });
	});

	isSent = signal(false);

	onSubmit(event: Event) {
		event.preventDefault();
		submit(this.forgotPasswordForm, async (form) => {
			try {
				await lastValueFrom(this.authService.forgotPassword(form.email().value()));
				this.isSent.set(true);
				this.snackBarService.success('Reset email sent! Please check your inbox.', { duration: 4000 });
				return undefined;
			} catch (error: any) {
				this.snackBarService.error('Failed to send reset email. Please try again.', { dismissible: true, duration: 3000, });
				return [{
					kind: 'server',
					fieldTree: this.forgotPasswordForm,
					message: error?.error?.message || 'Failed to send reset email. Please try again.',
				}];
			}
		});
	}
}
