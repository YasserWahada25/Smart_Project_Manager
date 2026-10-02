import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { Router, RouterLink } from '@angular/router';

import { SelfRegistrationRole } from '../../../core/auth/auth.models';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/models/api-error';
import { ToastService } from '../../../core/services/toast.service';
import { applyServerErrors, firstErrorMessage } from '../../../shared/forms/form-errors';
import {
  PASSWORD_ERROR_MESSAGES,
  passwordPolicyValidator,
  sameAsValidator,
} from '../../../shared/forms/password.validators';

type Field = 'firstName' | 'lastName' | 'email' | 'password' | 'confirmPassword';

@Component({
  selector: 'app-register',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatRadioModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './register.html',
  styleUrls: ['../auth-form.scss', './register.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Register {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly form = inject(NonNullableFormBuilder).group({
    firstName: ['', [Validators.required, Validators.maxLength(50)]],
    lastName: ['', [Validators.required, Validators.maxLength(50)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: ['', [Validators.required, passwordPolicyValidator]],
    confirmPassword: ['', [Validators.required, sameAsValidator('password')]],
    role: ['DEVELOPER' as SelfRegistrationRole, Validators.required],
  });
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly hidePassword = signal(true);

  protected readonly roles: { value: SelfRegistrationRole; label: string; hint: string }[] = [
    { value: 'DEVELOPER', label: 'Developer', hint: 'I work on the tasks of my team' },
    {
      value: 'PROJECT_MANAGER',
      label: 'Project manager',
      hint: 'I create projects and lead a team',
    },
  ];

  private readonly messages: Record<Field, Record<string, string>> = {
    firstName: { required: 'First name is required', maxlength: 'At most 50 characters' },
    lastName: { required: 'Last name is required', maxlength: 'At most 50 characters' },
    email: {
      required: 'Email is required',
      email: 'Enter a valid email address',
      maxlength: 'At most 254 characters',
    },
    password: PASSWORD_ERROR_MESSAGES,
    confirmPassword: { required: 'Confirm your password', mismatch: 'Passwords do not match' },
  };

  constructor() {
    // The confirmation must be re-checked when the password changes.
    this.form.controls.password.valueChanges
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

    const { firstName, lastName, email, password, role } = this.form.getRawValue();
    this.auth.register({ firstName, lastName, email, password, role }).subscribe({
      next: (user) => {
        this.toast.success(`Welcome, ${user.firstName}! Your account has been created.`);
        void this.router.navigateByUrl('/');
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        this.handleError(error);
      },
    });
  }

  private handleError(error: unknown): void {
    if (!(error instanceof ApiError)) {
      this.errorMessage.set('An unexpected error occurred.');
      return;
    }
    if (error.status === 409) {
      this.form.controls.email.setErrors({ server: 'This email is already registered' });
      this.form.controls.email.markAsTouched();
      return;
    }
    if (error.status === 400 && applyServerErrors(this.form, error)) return;
    this.errorMessage.set(error.message);
  }
}
