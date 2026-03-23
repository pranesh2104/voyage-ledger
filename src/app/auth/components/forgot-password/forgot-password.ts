import { Component, signal } from '@angular/core';

import { RouterModule } from '@angular/router';
import { email, form, required, submit } from '@angular/forms/signals';

@Component({
	selector: 'app-forgot-password',
	standalone: true,
	imports: [RouterModule],
	templateUrl: './forgot-password.html',
})
export class ForgotPassword {

	forgotPasswordModel = signal({ email: '' });

	forgotPasswordForm = form(this.forgotPasswordModel, (forgotPasswordForm) => {
		required(forgotPasswordForm.email, { message: 'Email is required' });
		email(forgotPasswordForm.email, { message: 'Please enter a valid email address' });
	});

	isSent = signal(false);

	onSubmit(event: Event) {
		event.preventDefault();
		submit(this.forgotPasswordForm, async (form) => {
			console.log('Form submitted:', form);
			await new Promise((resolve) => setTimeout(resolve, 1500));
			alert('Forgot password successful! (This is a demo)');
			this.isSent.set(true);
			return undefined;
		});
	}
}
