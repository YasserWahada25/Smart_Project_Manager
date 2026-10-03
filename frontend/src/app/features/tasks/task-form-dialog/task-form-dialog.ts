import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { ProjectMember } from '../../../core/models/project';
import { SPRINT_STATUS_LABELS, Sprint, isSprintOpen } from '../../../core/models/sprint';
import {
  STORY_POINTS,
  TASK_LIMITS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_TYPES,
  TASK_TYPE_LABELS,
  Task,
  TaskInput,
  TaskPriority,
  TaskType,
} from '../../../core/models/task';
import { fullName } from '../../../core/models/user';
import { TagInput } from '../../../shared/components/tag-input/tag-input';
import { toDateInput } from '../../../shared/dates';
import { firstErrorMessage, formSubmitError } from '../../../shared/forms/form-errors';
import { tagListValidator } from '../../../shared/forms/validators';
import { TaskService } from '../task.service';

export interface TaskFormData {
  projectId: string;
  /** Task to edit; absent to create one. */
  task?: Task;
  /** All the sprints of the project (only open ones can receive tasks). */
  sprints: Sprint[];
  /** Assignable members (creation only; afterwards the assignee is changed on the task page). */
  members: ProjectMember[];
  /** Pre-selected sprint for a new task (null = backlog). */
  sprintId?: string | null;
}

type Field = 'title' | 'description';

/** Creation / edition of a task; closes with the saved task. */
@Component({
  selector: 'app-task-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    TagInput,
  ],
  templateUrl: './task-form-dialog.html',
  styleUrl: './task-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskFormDialog {
  private readonly data = inject<TaskFormData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<TaskFormDialog, Task>>(MatDialogRef);
  private readonly taskService = inject(TaskService);

  protected readonly isEdit = this.data.task !== undefined;
  protected readonly limits = TASK_LIMITS;
  protected readonly types = TASK_TYPES;
  protected readonly typeLabels = TASK_TYPE_LABELS;
  protected readonly priorities = TASK_PRIORITIES;
  protected readonly priorityLabels = TASK_PRIORITY_LABELS;
  protected readonly storyPoints = STORY_POINTS;
  protected readonly sprintStatusLabels = SPRINT_STATUS_LABELS;
  protected readonly members = this.data.members;
  protected readonly fullName = fullName;
  /** Open sprints, plus the current (closed) sprint of an edited task so it stays displayed. */
  protected readonly sprintOptions = this.data.sprints.filter(
    (sprint) => isSprintOpen(sprint) || sprint.id === this.data.task?.sprint,
  );

  protected readonly form = inject(NonNullableFormBuilder).group({
    title: [
      this.data.task?.title ?? '',
      [
        Validators.required,
        Validators.pattern(/\S/),
        Validators.maxLength(TASK_LIMITS.titleMaxLength),
      ],
    ],
    description: [
      this.data.task?.description ?? '',
      Validators.maxLength(TASK_LIMITS.descriptionMaxLength),
    ],
    type: [this.data.task?.type ?? ('FEATURE' as TaskType)],
    priority: [this.data.task?.priority ?? ('MEDIUM' as TaskPriority)],
    complexity: [this.data.task?.complexity ?? 3],
    deadline: [toDateInput(this.data.task?.deadline)],
    requiredSkills: [
      this.data.task?.requiredSkills ?? ([] as string[]),
      tagListValidator(TASK_LIMITS.maxRequiredSkills, TASK_LIMITS.skillMaxLength),
    ],
    /** '' = backlog. */
    sprint: [this.data.task ? (this.data.task.sprint ?? '') : (this.data.sprintId ?? '')],
    /** '' = unassigned (creation only). */
    assignee: [''],
  });
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  private readonly messages: Record<Field, Record<string, string>> = {
    title: {
      required: 'Title is required',
      pattern: 'Title is required',
      maxlength: `At most ${TASK_LIMITS.titleMaxLength} characters`,
    },
    description: { maxlength: `At most ${TASK_LIMITS.descriptionMaxLength} characters` },
  };

  protected error(field: Field): string {
    return firstErrorMessage(this.form.controls[field], this.messages[field]);
  }

  protected fieldError(field: 'sprint' | 'assignee'): string {
    return firstErrorMessage(this.form.controls[field], {});
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set(null);

    const value = this.form.getRawValue();
    const input: TaskInput = {
      title: value.title.trim(),
      description: value.description.trim(),
      type: value.type,
      priority: value.priority,
      complexity: value.complexity,
      deadline: value.deadline || null,
      requiredSkills: value.requiredSkills,
      sprint: value.sprint || null,
    };
    const task = this.data.task;
    const request = task
      ? this.taskService.update(task.id, input)
      : this.taskService.create(this.data.projectId, {
          ...input,
          assignee: value.assignee || null,
        });

    request.subscribe({
      next: (saved) => this.dialogRef.close(saved),
      error: (error: unknown) => {
        this.submitting.set(false);
        this.errorMessage.set(formSubmitError(this.form, error));
      },
    });
  }
}
