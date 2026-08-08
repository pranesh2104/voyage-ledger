import { Component, DestroyRef, OnDestroy, OnInit, WritableSignal, computed, inject, signal } from '@angular/core';
import { AvatarComponent, SnackbarService } from 'voyage-lib';
import { AuthService } from '../../../auth/services/auth';
import { PASSWORD_PATTERN } from '../../../auth/constants/auth.constant';
import { ALLOWED_AVATAR_TYPES, MAX_AVATAR_BYTES } from '../../constants/account.constant';
import { email, form, FormField, maxLength, minLength, pattern, required, submit, validate } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [AvatarComponent, FormField],
  templateUrl: './account.component.html',
  styleUrls: ['./account.component.scss'],
})
export class AccountComponent implements OnInit, OnDestroy {

  currentEmail = signal('');

  displayName = signal('');
  avatarUrl = signal<string | null>(null);
  avatarPreviewUrl = signal<string | null>(null);
  isSavingAvatar = signal(false);
  avatarError = signal<string | null>(null);
  private selectedAvatarFile: File | null = null;

  showPassword = signal(false);
  showConfirmPassword = signal(false);

  passwordStrength = computed<'weak' | 'medium' | 'strong' | ''>(() => {
    const password = this.passwordModel().password;
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

  profileModel = signal({ displayName: '', userName: '' });

  emailModel: WritableSignal<{ email: string }> = signal({ email: '' });

  passwordModel: WritableSignal<{ password: string, confirmPassword: string }> = signal({ password: '', confirmPassword: '' });

  profileForm = form(this.profileModel, (profileSchema) => {
    required(profileSchema.displayName, { message: 'Display name is required.' });
    maxLength(profileSchema.displayName, 20, { message: 'Must be less than 20 characters.' });
    required(profileSchema.userName, { message: 'User name is required.' });
    maxLength(profileSchema.userName, 20, { message: 'Must be less than 20 characters.' });
  });

  emailForm = form(this.emailModel, (emailSchema) => {
    required(emailSchema.email, { message: 'Email is required.' });
    email(emailSchema.email, { message: 'Enter a valid email address.' });
  });

  passwordForm = form(this.passwordModel, (passwordSchema) => {
    required(passwordSchema.password, { message: 'Password is required.' });
    minLength(passwordSchema.password, 8, { message: 'Must be at least 8 characters.' });
    pattern(passwordSchema.password, PASSWORD_PATTERN, { message: 'Must contain uppercase, lowercase, number, and special character.' });
    required(passwordSchema.confirmPassword, { message: 'Please confirm your new password.' });
    validate(passwordSchema.confirmPassword, ({ value, valueOf }) => {
      if (value() !== valueOf(passwordSchema.password)) {
        return { kind: 'password-mismatch', message: 'Passwords are not identical' }
      }
      return undefined;
    })
  });

  private readonly authService = inject(AuthService);
  private readonly snackbarService = inject(SnackbarService);

  ngOnInit(): void {
    const user = this.authService.currentuser();
    const { display_name, username, email, avatar_url } = user || {};

    this.profileModel.set({ displayName: display_name ?? '', userName: username ?? '' });

    this.displayName.set(display_name ?? username ?? '');
    this.avatarUrl.set(avatar_url ?? null);

    this.currentEmail.set(email ?? '');
  }

  togglePasswordVisibility(): void {
    this.showPassword.update(v => !v);
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.update(v => !v);
  }

  async onSaveProfile(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.profileForm, async (profileForm) => {
      try {
        const { displayName, userName } = this.profileForm().value();
        const userResponse = await firstValueFrom(this.authService.updateProfile(displayName, userName));
        this.authService.setCurrentUser(userResponse.data.user);
        this.snackbarService.success('Profile updated successfully.', { duration: 3000 });
        return undefined;
      } catch (error: any) {
        this.snackbarService.error('Failed to update profile. Please try again.', { duration: 4000 });
        return {
          kind: 'server',
          fieldTree: profileForm,
          error: error.error.message || 'Profile update failed due to server error'
        }
      }
    });
  }

  async onSaveEmail(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.emailForm, async (emailForm) => {
      try {
        await firstValueFrom(this.authService.updateEmail(this.emailForm.email().value()));
        this.snackbarService.success('Confirmation links sent. Check both your current and new email to complete the change.', { duration: 5000 });
        return undefined;
      } catch (error: any) {
        this.snackbarService.error(error.error.message || 'Failed to update email. Please try again.', { duration: 4000 });
        return {
          kind: 'server',
          fieldTree: emailForm,
          error: error.error.message || 'Save email failed due to server error'
        }
      }
    });
  }

  async onSavePassword(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.passwordForm, async (passwordForm) => {
      try {
        await firstValueFrom(this.authService.updatePassword(this.passwordForm.password().value()));
        this.snackbarService.success('Password updated successfully.', { duration: 3000 });
        return undefined;
      } catch (error: any) {
        this.snackbarService.error('Failed to update password. Please try again.', { duration: 4000 });
        return {
          kind: 'server',
          fieldTree: passwordForm.password,
          error: error.error.message || 'Save password failed due to server error'
        }
      }
    });
  }

  onAvatarFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file) return;

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      this.avatarError.set('Please choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      this.avatarError.set('Image must be smaller than 2MB.');
      return;
    }

    this.avatarError.set(null);
    this.revokeAvatarPreview();
    this.selectedAvatarFile = file;
    this.avatarPreviewUrl.set(URL.createObjectURL(file));
  }

  cancelAvatarSelection(): void {
    this.selectedAvatarFile = null;
    this.revokeAvatarPreview();
    this.avatarError.set(null);
  }

  saveAvatar(): void {
    if (!this.selectedAvatarFile || this.isSavingAvatar()) return;

    this.isSavingAvatar.set(true);
    this.authService.uploadAvatar(this.selectedAvatarFile).subscribe({
      next: (res) => {
        this.isSavingAvatar.set(false);
        this.selectedAvatarFile = null;
        this.revokeAvatarPreview();
        this.authService.setCurrentUser(res.data.user);
        this.avatarUrl.set(res.data.user.avatar_url ?? null);
        this.snackbarService.success('Profile photo updated.', { duration: 3000 });
      },
      error: () => {
        this.isSavingAvatar.set(false);
        this.snackbarService.error('Failed to upload photo. Please try again.', { duration: 4000 });
      },
    });
  }

  removeAvatar(): void {
    if (this.isSavingAvatar()) return;

    this.isSavingAvatar.set(true);
    this.authService.removeAvatar().subscribe({
      next: (res) => {
        this.isSavingAvatar.set(false);
        this.authService.setCurrentUser(res.data.user);
        this.avatarUrl.set(null);
        this.snackbarService.success('Profile photo removed.', { duration: 3000 });
      },
      error: () => {
        this.isSavingAvatar.set(false);
        this.snackbarService.error('Failed to remove photo. Please try again.', { duration: 4000 });
      },
    });
  }

  private revokeAvatarPreview(): void {
    const preview = this.avatarPreviewUrl();
    if (preview) URL.revokeObjectURL(preview);
    this.avatarPreviewUrl.set(null);
  }

  ngOnDestroy(): void {
    this.revokeAvatarPreview();
  }
}
