import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { EMPTY, catchError, filter, finalize, switchMap } from 'rxjs';

import { actionErrorMessage } from '../../../core/http/action-error';
import { PROJECT_LIMITS, ProjectMember } from '../../../core/models/project';
import { SKILL_LEVEL_LABELS, fullName } from '../../../core/models/user';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { AddMembersDialog, AddMembersDialogData } from '../add-members-dialog/add-members-dialog';
import { ProjectContext } from '../project-context';
import { ProjectService } from '../project.service';
import { Avatar } from '../../../shared/components/avatar/avatar';

/**
 * "Overview" tab of a project: description, dates, manager, technologies and team. The
 * project manager builds the team from the developer directory and removes members.
 */
@Component({
  selector: 'app-project-overview',
  imports: [Avatar, DatePipe, MatCardModule, MatButtonModule, MatIconModule],
  templateUrl: './project-overview.html',
  styleUrl: './project-overview.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectOverview {
  private readonly context = inject(ProjectContext);
  private readonly projectService = inject(ProjectService);
  private readonly confirmService = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly levelLabels = SKILL_LEVEL_LABELS;
  protected readonly maxMembers = PROJECT_LIMITS.maxMembers;
  protected readonly fullName = fullName;
  protected readonly project = this.context.project;
  protected readonly canEdit = this.context.canEdit;
  /** Member being removed. */
  protected readonly removingId = signal<string | null>(null);

  protected openAddMembers(): void {
    this.dialog.open<AddMembersDialog, AddMembersDialogData>(AddMembersDialog, {
      data: {
        project: this.context.current,
        onAdded: (updated) => this.context.project.set(updated),
      },
      width: '720px',
      maxWidth: 'calc(100vw - 32px)',
    });
  }

  protected removeMember(member: ProjectMember): void {
    const project = this.context.current;
    const name = fullName(member);
    this.confirmService
      .confirm({
        title: 'Remove this member?',
        message:
          `${name} will be removed from the team and will lose access to the project. ` +
          'A member who still has unfinished tasks cannot be removed: reassign them first.',
        confirmLabel: 'Remove',
        destructive: true,
      })
      .pipe(
        filter(Boolean),
        switchMap(() => {
          this.removingId.set(member.id);
          return this.projectService.removeMember(project.id, member.id).pipe(
            catchError((error: unknown) => {
              const message = actionErrorMessage(error);
              if (message) this.toast.error(message);
              return EMPTY;
            }),
            finalize(() => this.removingId.set(null)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((updated) => {
        this.context.project.set(updated);
        this.toast.success(`${name} has been removed from the team.`);
      });
  }
}
