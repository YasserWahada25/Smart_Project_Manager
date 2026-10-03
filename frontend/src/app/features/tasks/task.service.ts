import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Paginated } from '../../core/models/pagination';
import {
  AssignedTask,
  Board,
  Task,
  TaskInput,
  TaskPriority,
  TaskStatus,
  TaskType,
} from '../../core/models/task';

/** Filters of GET /projects/:id/tasks (page is 1-based). */
export interface TaskQuery {
  page: number;
  limit: number;
  status?: TaskStatus;
  priority?: TaskPriority;
  type?: TaskType;
  /** User id or `unassigned`. */
  assignee?: string;
  /** Sprint id or `backlog`. */
  sprint?: string;
  search?: string;
  overdue?: boolean;
}

export interface AssignedTaskQuery {
  page: number;
  limit: number;
  status?: TaskStatus;
}

function toParams(query: object): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    params = params.set(key, typeof value === 'string' ? value.trim() : String(value));
  }
  return params;
}

/**
 * Tasks of a project. Permissions are enforced by the backend: the project manager creates,
 * edits, assigns and deletes; the assignee (and the manager) changes the status.
 */
@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  list(projectId: string, query: TaskQuery): Observable<Paginated<Task>> {
    return this.http.get<Paginated<Task>>(`${this.api}/projects/${projectId}/tasks`, {
      params: toParams(query),
    });
  }

  /** Tasks assigned to the signed-in user, in the projects they can access ("My tasks"). */
  assigned(query: AssignedTaskQuery): Observable<Paginated<AssignedTask>> {
    return this.http.get<Paginated<AssignedTask>>(`${this.api}/tasks/assigned`, {
      params: toParams(query),
    });
  }

  /**
   * Kanban board of the project: `sprint` = a sprint id, `backlog` (tasks without sprint) or
   * undefined (all the tasks of the project).
   */
  board(projectId: string, sprint?: string): Observable<Board> {
    return this.http.get<Board>(`${this.api}/projects/${projectId}/board`, {
      params: toParams({ sprint }),
    });
  }

  get(id: string): Observable<Task> {
    return this.http.get<{ task: Task }>(`${this.api}/tasks/${id}`).pipe(map(unwrap));
  }

  /** New tasks start in TODO; `assignee` must be an active member of the project. */
  create(projectId: string, input: TaskInput & { assignee: string | null }): Observable<Task> {
    const { deadline, ...rest } = input;
    const body = deadline ? input : rest;
    return this.http
      .post<{ task: Task }>(`${this.api}/projects/${projectId}/tasks`, body)
      .pipe(map(unwrap));
  }

  update(id: string, changes: Partial<TaskInput>): Observable<Task> {
    return this.http.patch<{ task: Task }>(`${this.api}/tasks/${id}`, changes).pipe(map(unwrap));
  }

  /** Workflow transition; `blockedReason` is only kept while BLOCKED. */
  setStatus(id: string, status: TaskStatus, blockedReason?: string): Observable<Task> {
    const body = blockedReason ? { status, blockedReason } : { status };
    return this.http
      .patch<{ task: Task }>(`${this.api}/tasks/${id}/status`, body)
      .pipe(map(unwrap));
  }

  /** `null` unassigns the task. */
  setAssignee(id: string, assigneeId: string | null): Observable<Task> {
    return this.http
      .patch<{ task: Task }>(`${this.api}/tasks/${id}/assignee`, { assigneeId })
      .pipe(map(unwrap));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/tasks/${id}`);
  }
}

function unwrap({ task }: { task: Task }): Task {
  return task;
}
