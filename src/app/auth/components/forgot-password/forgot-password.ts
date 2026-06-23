import { Component, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { email, form, required, submit } from '@angular/forms/signals';
import { AuthService } from '../../services/auth';
import { lastValueFrom } from 'rxjs';

@Component({
	selector: 'app-forgot-password',
	standalone: true,
	imports: [RouterModule],
	templateUrl: './forgot-password.html',
})
export class ForgotPassword {

	private authService = inject(AuthService);

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
				return undefined;
			} catch (error: any) {
				return [{
					kind: 'server',
					fieldTree: this.forgotPasswordForm,
					message: error?.error?.message || 'Failed to send reset email. Please try again.',
				}];
			}
		});
	}
}
