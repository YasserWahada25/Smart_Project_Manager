import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { SPRINT_LIMITS, Sprint, SprintInput } from '../../../core/models/sprint';
import { addDays, toDateInput, todayIsoDate } from '../../../shared/dates';
import { firstErrorMessage, formSubmitError } from '../../../shared/forms/form-errors';
import { notBeforeValidator } from '../../../shared/forms/validators';
import { SprintService } from '../sprint.service';

export interface SprintFormData {
  projectId: string;
  /** Sprint to edit; absent to create one. */
  sprint?: Sprint;
}

type Field = 'name' | 'objective' | 'startDate' | 'endDate';

/** Default length of a new sprint: two weeks. */
const DEFAULT_SPRINT_DAYS = 13;

/** Creation / edition of a sprint; closes with the saved sprint. */
@Component({
  selector: 'app-sprint-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  templateUrl: './sprint-form-dialog.html',
  styleUrl: './sprint-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SprintFormDialog {
  private readonly data = inject<SprintFormData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<SprintFormDialog, Sprint>>(MatDialogRef);
  private readonly sprintService = inject(SprintService);

  protected readonly isEdit = this.data.sprint !== undefined;
  protected readonly limits = SPRINT_LIMITS;
  protected readonly form = inject(NonNullableFormBuilder).group({
    name: [
      this.data.sprint?.name ?? '',
      [
        Validators.required,
        Validators.pattern(/\S/),
        Validators.maxLength(SPRINT_LIMITS.nameMaxLength),
      ],
    ],
    objective: [
      this.data.sprint?.objective ?? '',
      Validators.maxLength(SPRINT_LIMITS.objectiveMaxLength),
    ],
    startDate: [toDateInput(this.data.sprint?.startDate) || todayIsoDate(), Validators.required],
    endDate: [
      toDateInput(this.data.sprint?.endDate) || addDays(todayIsoDate(), DEFAULT_SPRINT_DAYS),
      [Validators.required, notBeforeValidator('startDate')],
    ],
  });
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  private readonly messages: Record<Field, Record<string, string>> = {
    name: {
      required: 'Sprint name is required',
      pattern: 'Sprint name is required',
      maxlength: `At most ${SPRINT_LIMITS.nameMaxLength} characters`,
    },
    objective: { maxlength: `At most ${SPRINT_LIMITS.objectiveMaxLength} characters` },
    startDate: { required: 'Start date is required' },
    endDate: {
      required: 'End date is required',
      notBefore: 'The end date must be on or after the start date',
    },
  };

  constructor() {
    this.form.controls.startDate.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.form.controls.endDate.updateValueAndValidity());
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

    const { name, objective, startDate, endDate } = this.form.getRawValue();
    const input: SprintInput = {
      name: name.trim(),
      objective: objective.trim(),
      startDate,
      endDate,
    };
    const sprint = this.data.sprint;
    const request = sprint
      ? this.sprintService.update(sprint.id, input)
      : this.sprintService.create(this.data.projectId, input);

    request.subscribe({
      next: (saved) => this.dialogRef.close(saved),
      error: (error: unknown) => {
        this.submitting.set(false);
        this.errorMessage.set(formSubmitError(this.form, error));
      },
    });
  }
}
