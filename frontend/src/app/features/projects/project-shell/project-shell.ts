import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTabsModule } from '@angular/material/tabs';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { EMPTY, Observable, catchError, filter, finalize, of, switchMap } from 'rxjs';

import { actionErrorMessage } from '../../../core/http/action-error';
import { ApiError } from '../../../core/models/api-error';
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  ProjectStatus,
} from '../../../core/models/project';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { LoadingState } from '../../../shared/components/loading-state/loading-state';
import { ProjectContext } from '../project-context';
import { ProjectService } from '../project.service';

interface ProjectTab {
  label: string;
  /** Relative to /projects/:id ('.' = overview). */
  path: string;
  /** Exact match for the active state (the overview path is a prefix of the others). */
  exact: boolean;
  /** Shown only to the manager of a project that is not archived. */
  managerOnly?: boolean;
}

/** Sections of a project, each one a child route of /projects/:id. */
export const PROJECT_TABS: readonly ProjectTab[] = [
  { label: 'Overview', path: '.', exact: true },
  { label: 'Sprints', path: 'sprints', exact: false },
  { label: 'Tasks', path: 'tasks', exact: false },
  { label: 'Board', path: 'board', exact: false },
  { label: 'Activity', path: 'activity', exact: false },
  { label: 'Dashboard', path: 'dashboard', exact: false },
  { label: 'Assistant', path: 'assistant', exact: false, managerOnly: true },
];

/**
 * Project page shell (`/projects/:id`): loads the project, shows its header (name, status,
 * manager actions) and the tabs; each tab is a child route sharing the ProjectContext.
 */
@Component({
  selector: 'app-project-shell',
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTabsModule,
    LoadingState,
    ErrorState,
  ],
  providers: [ProjectContext],
  templateUrl: './project-shell.html',
  styleUrl: './project-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectShell {
  /** Route parameter. */
  readonly id = input.required<string>();

  private readonly projectService = inject(ProjectService);
  private readonly context = inject(ProjectContext);
  private readonly confirmService = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly tabs = computed(() =>
    PROJECT_TABS.filter((tab) => !tab.managerOnly || this.context.canEdit()),
  );
  protected readonly statusLabels = PROJECT_STATUS_LABELS;
  protected readonly project = this.context.project;
  protected readonly isManager = this.context.isManager;
  protected readonly isArchived = this.context.isArchived;
  protected readonly loading = signal(true);
  protected readonly loadError = signal<{ message: string; retryable: boolean } | null>(null);
  /** A status change or the deletion is in progress. */
  protected readonly busy = signal(false);
  protected readonly otherStatuses = computed(() =>
    PROJECT_STATUSES.filter((status) => status !== this.project()?.status),
  );

  constructor() {
    // Reload when the route parameter changes (the component is reused between projects).
    toObservable(this.id)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.load());
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);

    this.projectService
      .get(this.id())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (project) => {
          this.context.project.set(project);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loadError.set(
            error instanceof ApiError
              ? { message: error.message, retryable: error.isNetworkError || error.status >= 500 }
              : { message: 'An unexpected error occurred.', retryable: true },
          );
          this.loading.set(false);
        },
      });
  }

  protected changeStatus(status: ProjectStatus): void {
    const project = this.project();
    if (!project) return;
    const confirmed: Observable<boolean> =
      status === 'ARCHIVED'
        ? this.confirmService.confirm({
            title: 'Archive this project?',
            message:
              'An archived project is read-only: its information, team, sprints and tasks can ' +
              'no longer be modified. You can change its status again later.',
            confirmLabel: 'Archive',
          })
        : of(true);

    confirmed
      .pipe(
        filter(Boolean),
        switchMap(() => this.run(this.projectService.setStatus(project.id, status))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((updated) => {
        this.context.project.set(updated);
        this.toast.success(`Project status changed to ${PROJECT_STATUS_LABELS[updated.status]}.`);
      });
  }

  protected deleteProject(): void {
    const project = this.project();
    if (!project) return;
    this.confirmService
      .confirm({
        title: 'Delete this project?',
        message:
          `"${project.name}" will be permanently deleted. Only a project without sprints or ` +
          'tasks can be deleted; otherwise, archive it.',
        confirmLabel: 'Delete',
        destructive: true,
      })
      .pipe(
        filter(Boolean),
        switchMap(() => this.run(this.projectService.delete(project.id))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.toast.success('The project has been deleted.');
        void this.router.navigateByUrl('/projects');
      });
  }

  /** Runs a project-level action with the busy flag; errors are shown in a toast. */
  private run<T>(request: Observable<T>): Observable<T> {
    this.busy.set(true);
    return request.pipe(
      catchError((error: unknown) => {
        const message = actionErrorMessage(error);
        if (message) this.toast.error(message);
        return EMPTY;
      }),
      finalize(() => this.busy.set(false)),
    );
  }
}
