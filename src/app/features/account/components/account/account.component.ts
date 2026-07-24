import { Component, DestroyRef, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AvatarComponent, SnackbarService } from 'voyage-lib';
import { AuthService } from '../../../auth/services/auth';
import { EMAIL_PATTERN, PASSWORD_PATTERN } from '../../../auth/constants/auth.constant';
import { ALLOWED_AVATAR_TYPES, MAX_AVATAR_BYTES } from '../../constants/account.constant';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [ReactiveFormsModule, AvatarComponent],
  templateUrl: './account.component.html',
  styleUrls: ['./account.component.scss'],
})
export class AccountComponent implements OnInit, OnDestroy {
  profileForm!: FormGroup;
  emailForm!: FormGroup;
  passwordForm!: FormGroup;

  isSavingProfile = signal(false);
  isSavingEmail = signal(false);
  isSavingPassword = signal(false);

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
    const password = this.passwordValue();
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
  private passwordValue = signal('');

  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly snackbarService = inject(SnackbarService);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    const user = this.authService.currentuser();
    const { display_name, username, email, avatar_url } = user || {};

    this.profileForm = this.fb.group({
      display_name: [display_name ?? '', [Validators.required, Validators.maxLength(100)]],
      username: [username ?? '', [Validators.required, Validators.maxLength(50)]],
    });

    this.displayName.set(display_name ?? username ?? '');
    this.avatarUrl.set(avatar_url ?? null);

    this.currentEmail.set(email ?? '');
    this.emailForm = this.fb.group({
      email: ['', [Validators.required, Validators.pattern(EMAIL_PATTERN)]],
    });

    this.passwordForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(PASSWORD_PATTERN)]],
      confirmPassword: ['', Validators.required],
    }, { validators: this.passwordMatchValidator });

    this.passwordForm.get('password')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(value => this.passwordValue.set(value ?? ''));
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;
    if (password && confirmPassword && password !== confirmPassword) {
      return { passwordMismatch: true };
    }
    return null;
  }

  get displayNameControl() { return this.profileForm.get('display_name'); }
  get usernameControl() { return this.profileForm.get('username'); }
  get emailControl() { return this.emailForm.get('email'); }
  get passwordControl() { return this.passwordForm.get('password'); }
  get confirmPasswordControl() { return this.passwordForm.get('confirmPassword'); }

  hasPasswordMismatch(): boolean {
    return !!(this.passwordForm.hasError('passwordMismatch') && this.confirmPasswordControl?.touched);
  }

  togglePasswordVisibility(): void {
    this.showPassword.update(v => !v);
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.update(v => !v);
  }

  saveProfile(): void {
    this.profileForm.markAllAsTouched();
    if (!this.profileForm.valid || this.isSavingProfile()) return;

    this.isSavingProfile.set(true);
    const { display_name, username } = this.profileForm.value;
    this.authService.updateProfile(display_name, username).subscribe({
      next: (res) => {
        this.isSavingProfile.set(false);
        this.authService.setCurrentUser(res.data.user);
        this.snackbarService.success('Profile updated successfully.', { duration: 3000 });
      },
      error: () => {
        this.isSavingProfile.set(false);
        this.snackbarService.error('Failed to update profile. Please try again.', { duration: 4000 });
      },
    });
  }

  saveEmail(): void {
    this.emailForm.markAllAsTouched();
    if (!this.emailForm.valid || this.isSavingEmail()) return;

    this.isSavingEmail.set(true);
    this.authService.updateEmail(this.emailForm.value.email).subscribe({
      next: () => {
        this.isSavingEmail.set(false);
        this.emailForm.reset();
        this.snackbarService.success('Confirmation links sent. Check both your current and new email to complete the change.', { duration: 5000 });
      },
      error: () => {
        this.isSavingEmail.set(false);
        this.snackbarService.error('Failed to update email. Please try again.', { duration: 4000 });
      },
    });
  }

  savePassword(): void {
    this.passwordForm.markAllAsTouched();
    if (!this.passwordForm.valid || this.isSavingPassword()) return;

    this.isSavingPassword.set(true);
    this.authService.updatePassword(this.passwordForm.value.password).subscribe({
      next: () => {
        this.isSavingPassword.set(false);
        this.passwordForm.reset();
        this.snackbarService.success('Password updated successfully.', { duration: 3000 });
      },
      error: () => {
        this.isSavingPassword.set(false);
        this.snackbarService.error('Failed to update password. Please try again.', { duration: 4000 });
      },
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
