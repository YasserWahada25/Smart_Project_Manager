import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { TASK_LIMITS } from '../../../core/models/task';

/**
 * Optional reason given when a task is blocked. Closes with the reason ('' when none was
 * given) or undefined when cancelled.
 */
@Component({
  selector: 'app-block-reason-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  template: `
    <h2 mat-dialog-title>Block the task</h2>
    <mat-dialog-content>
      <p class="task-title">{{ data.title }}</p>
      <mat-form-field appearance="outline">
        <mat-label>Reason (optional)</mat-label>
        <textarea matInput [formControl]="reason" rows="3" cdkFocusInitial></textarea>
        <mat-hint align="end">{{ reason.value.length }} / {{ maxLength }}</mat-hint>
        @if (reason.invalid) {
          <mat-error>At most {{ maxLength }} characters</mat-error>
        }
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Cancel</button>
      <button mat-flat-button type="button" [disabled]="reason.invalid" (click)="confirm()">
        Block the task
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .task-title {
      margin: 0 0 12px;
      font: var(--mat-sys-title-small);
    }
    mat-form-field {
      width: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockReasonDialog {
  protected readonly data = inject<{ title: string }>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<BlockReasonDialog, string>>(MatDialogRef);

  protected readonly maxLength = TASK_LIMITS.blockedReasonMaxLength;
  protected readonly reason = new FormControl('', {
    nonNullable: true,
    validators: Validators.maxLength(TASK_LIMITS.blockedReasonMaxLength),
  });

  protected confirm(): void {
    this.dialogRef.close(this.reason.value.trim());
  }
}
