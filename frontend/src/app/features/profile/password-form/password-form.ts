import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormGroupDirective,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

import { ToastService } from '../../../core/services/toast.service';
import { firstErrorMessage, formSubmitError } from '../../../shared/forms/form-errors';
import {
  PASSWORD_ERROR_MESSAGES,
  passwordPolicyValidator,
  sameAsValidator,
} from '../../../shared/forms/password.validators';
import { ProfileService } from '../profile.service';

type Field = 'currentPassword' | 'newPassword' | 'confirmPassword';

/**
 * Password change (PATCH /profile/password). The other sessions of the user are signed out
 * by the backend; this tab keeps working with the new token.
 */
@Component({
  selector: 'app-password-form',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './password-form.html',
  styleUrl: '../profile-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasswordForm {
  private readonly profileService = inject(ProfileService);
  private readonly toast = inject(ToastService);

  protected readonly form = inject(NonNullableFormBuilder).group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, passwordPolicyValidator]],
    confirmPassword: ['', [Validators.required, sameAsValidator('newPassword')]],
  });
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly hidePasswords = signal(true);
  private readonly formDirective = viewChild(FormGroupDirective);

  private readonly messages: Record<Field, Record<string, string>> = {
    currentPassword: { required: 'Enter your current password' },
    newPassword: { ...PASSWORD_ERROR_MESSAGES, required: 'Enter a new password' },
    confirmPassword: { required: 'Confirm the new password', mismatch: 'Passwords do not match' },
  };

  constructor() {
    // The confirmation must be re-checked when the new password changes.
    this.form.controls.newPassword.valueChanges
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this.form.controls.confirmPassword.updateValueAndValidity());
  }

  protected error(field: Field): string {
    return firstErrorMessage(this.form.controls[field], this.messages[field]);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set(null);

    const { currentPassword, newPassword } = this.form.getRawValue();
    this.profileService.changePassword({ currentPassword, newPassword }).subscribe({
      next: () => {
        this.submitting.set(false);
        // resetForm() also clears the "submitted" state: no "required" errors on the empty form.
        this.formDirective()?.resetForm();
        this.toast.success(
          'Your password has been changed. Your other devices have been signed out.',
        );
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        this.errorMessage.set(formSubmitError(this.form, error));
      },
    });
  }
}
