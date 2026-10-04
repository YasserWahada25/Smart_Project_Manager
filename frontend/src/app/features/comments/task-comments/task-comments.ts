import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { EMPTY, catchError, filter, finalize, switchMap } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { actionErrorMessage } from '../../../core/http/action-error';
import { COMMENT_MAX_LENGTH, Comment } from '../../../core/models/comment';
import { fullName } from '../../../core/models/user';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { LoadMoreList } from '../../../shared/data/load-more-list';
import { ProjectContext } from '../../projects/project-context';
import { CommentService } from '../comment.service';
import { Avatar } from '../../../shared/components/avatar/avatar';

const PAGE_SIZE = 20;

const contentValidators = [
  Validators.required,
  Validators.pattern(/\S/),
  Validators.maxLength(COMMENT_MAX_LENGTH),
];

/**
 * Comments of a task, oldest first. The project manager and the members comment (not
 * administrators); the author edits their comment; the author or the project manager deletes
 * it. Nothing can be changed in an archived project.
 */
@Component({
  selector: 'app-task-comments',
  imports: [
    Avatar,
    DatePipe,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    ErrorState,
  ],
  templateUrl: './task-comments.html',
  styleUrl: './task-comments.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskComments {
  readonly taskId = input.required<string>();
  /** Emitted after a comment is posted (the history of the task changed). */
  readonly commented = output<void>();

  private readonly context = inject(ProjectContext);
  private readonly auth = inject(AuthService);
  private readonly commentService = inject(CommentService);
  private readonly confirmService = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly maxLength = COMMENT_MAX_LENGTH;
  protected readonly fullName = fullName;
  protected readonly list = new LoadMoreList<Comment>(
    (page) => this.commentService.list(this.taskId(), page, PAGE_SIZE),
    this.destroyRef,
  );
  private readonly userId = computed(() => this.auth.currentUser()?.id);
  /** The project manager and the members can comment (administrators cannot). */
  protected readonly canComment = computed(() => {
    if (this.context.isArchived()) return false;
    if (this.context.isManager()) return true;
    return (this.context.project()?.members ?? []).some((member) => member.id === this.userId());
  });

  protected readonly content = new FormControl('', {
    nonNullable: true,
    validators: contentValidators,
  });
  protected readonly posting = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly editContent = new FormControl('', {
    nonNullable: true,
    validators: contentValidators,
  });

  constructor() {
    effect(() => {
      this.taskId();
      untracked(() => this.list.reset());
    });
  }

  protected canEditComment(comment: Comment): boolean {
    return !this.context.isArchived() && comment.author.id === this.userId();
  }

  /** The author, or the project manager (moderation). */
  protected canDeleteComment(comment: Comment): boolean {
    return this.canEditComment(comment) || this.context.canEdit();
  }

  protected contentError(control: FormControl<string>): string {
    if (control.hasError('maxlength')) return `At most ${COMMENT_MAX_LENGTH} characters`;
    return 'Write a comment';
  }

  protected post(): void {
    if (this.content.invalid) {
      this.content.markAsTouched();
      return;
    }
    this.posting.set(true);
    this.commentService
      .create(this.taskId(), this.content.value.trim())
      .pipe(
        finalize(() => this.posting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.content.reset();
          // Comments are listed oldest first: reload so the new one appears at the end.
          this.list.reset();
          this.commented.emit();
        },
        error: (error: unknown) => this.report(error),
      });
  }

  protected startEdit(comment: Comment): void {
    this.editingId.set(comment.id);
    this.editContent.reset(comment.content);
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
  }

  protected saveEdit(comment: Comment): void {
    if (this.editContent.invalid) {
      this.editContent.markAsTouched();
      return;
    }
    this.commentService
      .update(comment.id, this.editContent.value.trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.list.replace(updated);
          this.editingId.set(null);
        },
        error: (error: unknown) => this.report(error),
      });
  }

  protected deleteComment(comment: Comment): void {
    this.confirmService
      .confirm({
        title: 'Delete this comment?',
        message: 'The comment will be permanently deleted.',
        confirmLabel: 'Delete',
        destructive: true,
      })
      .pipe(
        filter(Boolean),
        switchMap(() =>
          this.commentService.delete(comment.id).pipe(
            catchError((error: unknown) => {
              this.report(error);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.list.remove(comment.id));
  }

  private report(error: unknown): void {
    const message = actionErrorMessage(error);
    if (message) this.toast.error(message);
  }
}
