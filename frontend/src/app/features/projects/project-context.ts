import { Injectable, computed, inject, signal } from '@angular/core';

import { AuthService } from '../../core/auth/auth.service';
import { Project } from '../../core/models/project';

/**
 * Project currently displayed by ProjectShell, shared with its tabs (overview, sprints,
 * tasks…). Provided by ProjectShell: the tabs are only created once the project is loaded.
 */
@Injectable()
export class ProjectContext {
  private readonly auth = inject(AuthService);

  readonly project = signal<Project | null>(null);

  /** Only the project manager (its creator) can modify the project — backend rule. */
  readonly isManager = computed(() => this.project()?.manager.id === this.auth.currentUser()?.id);
  readonly isArchived = computed(() => this.project()?.status === 'ARCHIVED');
  /** The manager can modify the project (an archived project is read-only). */
  readonly canEdit = computed(() => this.isManager() && !this.isArchived());
  /** Members who can be assigned tasks (deactivated accounts cannot). */
  readonly activeMembers = computed(() =>
    (this.project()?.members ?? []).filter((member) => member.isActive),
  );

  /** The project manager and the assignee change the status of a task (not while archived). */
  canChangeStatus(task: { assignee: { id: string } | null }): boolean {
    if (this.isArchived()) return false;
    return this.isManager() || task.assignee?.id === this.auth.currentUser()?.id;
  }

  /** The loaded project (the tabs are rendered only when it is available). */
  get current(): Project {
    const project = this.project();
    if (!project) throw new Error('ProjectContext: the project is not loaded');
    return project;
  }
}
