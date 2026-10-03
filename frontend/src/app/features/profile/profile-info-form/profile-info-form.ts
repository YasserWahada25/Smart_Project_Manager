import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  FormGroupDirective,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { User } from '../../../core/models/user';
import { ToastService } from '../../../core/services/toast.service';
import { firstErrorMessage, formSubmitError } from '../../../shared/forms/form-errors';
import { ProfileService } from '../profile.service';

type Field = 'firstName' | 'lastName' | 'jobTitle' | 'bio';

const NOT_BLANK = /\S/;

/** First name, last name, job title and bio (PATCH /profile). */
@Component({
  selector: 'app-profile-info-form',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  templateUrl: './profile-info-form.html',
  styleUrl: '../profile-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileInfoForm implements OnInit {
  readonly user = input.required<User>();
  readonly saved = output<User>();

  private readonly profileService = inject(ProfileService);
  private readonly toast = inject(ToastService);

  protected readonly bioMaxLength = 500;
  protected readonly form = inject(NonNullableFormBuilder).group({
    firstName: ['', [Validators.required, Validators.pattern(NOT_BLANK), Validators.maxLength(50)]],
    lastName: ['', [Validators.required, Validators.pattern(NOT_BLANK), Validators.maxLength(50)]],
    jobTitle: ['', Validators.maxLength(100)],
    bio: ['', Validators.maxLength(this.bioMaxLength)],
  });
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  private readonly formDirective = viewChild(FormGroupDirective);

  private readonly messages: Record<Field, Record<string, string>> = {
    firstName: {
      required: 'First name is required',
      pattern: 'First name is required',
      maxlength: 'At most 50 characters',
    },
    lastName: {
      required: 'Last name is required',
      pattern: 'Last name is required',
      maxlength: 'At most 50 characters',
    },
    jobTitle: { maxlength: 'At most 100 characters' },
    bio: { maxlength: `At most ${this.bioMaxLength} characters` },
  };

  ngOnInit(): void {
    this.reset(this.user());
  }

  protected error(field: Field): string {
    return firstErrorMessage(this.form.controls[field], this.messages[field]);
  }

  protected cancel(): void {
    this.errorMessage.set(null);
    this.reset(this.user());
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set(null);

    const { firstName, lastName, jobTitle, bio } = this.form.getRawValue();
    this.profileService
      .update({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        jobTitle: jobTitle.trim(),
        bio: bio.trim(),
      })
      .subscribe({
        next: (user) => {
          this.submitting.set(false);
          this.reset(user);
          this.toast.success('Your profile has been updated.');
          this.saved.emit(user);
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          this.errorMessage.set(formSubmitError(this.form, error));
        },
      });
  }

  private reset({ firstName, lastName, jobTitle, bio }: User): void {
    const values = { firstName, lastName, jobTitle, bio };
    // resetForm() also clears the "submitted" state. In ngOnInit the directive exists but is
    // not bound to the form yet.
    const directive = this.formDirective();
    if (directive?.form) directive.resetForm(values);
    else this.form.reset(values);
  }
}
