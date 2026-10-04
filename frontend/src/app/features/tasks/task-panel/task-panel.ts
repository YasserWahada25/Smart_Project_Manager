import { ChangeDetectionStrategy, Component, Injectable, Injector, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';

import { TaskDetail } from '../task-detail/task-detail';

export interface TaskPanelData {
  projectId: string;
  taskId: string;
}

/**
 * A task opened in a panel on the right of the board or the list (Linear / Jira "peek"): the whole
 * task page (details, workflow, assignment, AI recommendation, comments, history) without leaving
 * the current view. "Open full page" goes to /projects/:id/tasks/:taskId.
 */
@Component({
  selector: 'app-task-panel',
  imports: [MatDialogModule, MatButtonModule, MatIconModule, RouterLink, TaskDetail],
  template: `
    <div class="panel-header">
      <a
        mat-button
        [routerLink]="['/projects', data.projectId, 'tasks', data.taskId]"
        mat-dialog-close
      >
        <mat-icon>open_in_full</mat-icon>
        Open full page
      </a>
      <span class="grow"></span>
      <button mat-icon-button type="button" mat-dialog-close aria-label="Close the task panel">
        <mat-icon>close</mat-icon>
      </button>
    </div>
    <div class="panel-body">
      <app-task-detail [taskId]="data.taskId" [embedded]="true" />
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .panel-header {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 8px 12px;
      border-bottom: 1px solid var(--spm-border);
    }
    .grow {
      flex: 1;
    }
    .panel-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px 24px 24px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskPanel {
  protected readonly data = inject<TaskPanelData>(MAT_DIALOG_DATA);
}

/** Opens a task in the side panel; `injector` must provide the ProjectContext of the project page. */
@Injectable({ providedIn: 'root' })
export class TaskPanelService {
  private readonly dialog = inject(MatDialog);

  open(data: TaskPanelData, injector: Injector): Observable<unknown> {
    return this.dialog
      .open(TaskPanel, {
        data,
        injector,
        width: '640px',
        maxWidth: '100vw',
        height: '100%',
        position: { top: '0', right: '0' },
        panelClass: 'side-panel',
        autoFocus: 'dialog',
        ariaLabel: 'Task',
      })
      .afterClosed();
  }
}
