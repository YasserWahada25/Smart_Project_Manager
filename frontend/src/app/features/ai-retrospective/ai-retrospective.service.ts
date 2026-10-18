import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../../core/http/api-error.interceptor';
import { RetrospectiveResult, RetrospectiveTaskResult } from '../../core/models/ai-retrospective';

/** AI-05: retrospective of a completed sprint, and tasks created from its actions. */
@Injectable({ providedIn: 'root' })
export class AiRetrospectiveService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  /** The saved retrospective, or null. The dialog shows the errors itself. */
  get(sprintId: string): Observable<RetrospectiveResult> {
    return this.http.get<RetrospectiveResult>(`${this.api}/sprints/${sprintId}/ai/retrospective`, {
      context: new HttpContext().set(SKIP_ERROR_TOAST, true),
    });
  }

  /** Generates (or regenerates) it: 409 if the sprint is not completed, 502 / 503 / 504 for the AI. */
  generate(sprintId: string): Observable<RetrospectiveResult> {
    return this.http.post<RetrospectiveResult>(
      `${this.api}/sprints/${sprintId}/ai/retrospective`,
      {},
      { context: new HttpContext().set(SKIP_ERROR_TOAST, true) },
    );
  }

  /** A task from an action, in an open sprint or the backlog (sprint null); 409 if already created. */
  createTask(
    sprintId: string,
    actionId: string,
    sprint: string | null,
  ): Observable<RetrospectiveTaskResult> {
    return this.http.post<RetrospectiveTaskResult>(
      `${this.api}/sprints/${sprintId}/ai/retrospective/actions/${actionId}/task`,
      { sprint },
    );
  }
}
