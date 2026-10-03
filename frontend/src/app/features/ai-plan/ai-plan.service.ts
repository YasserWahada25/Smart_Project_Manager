import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../../core/http/api-error.interceptor';
import { AiPlan, ApplyPlanInput, ApplyPlanResult, PlanRequest } from '../../core/models/ai-plan';

/** AI-01: proposal of sprints and tasks from the specification, then creation of the reviewed plan. */
@Injectable({ providedIn: 'root' })
export class AiPlanService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  /**
   * Sends the specification (multipart form) and returns the proposed plan; nothing is stored.
   * The page shows every error itself (AI unavailable, timeout…): no global toast.
   */
  generate(projectId: string, request: PlanRequest): Observable<AiPlan> {
    const form = new FormData();
    if (request.text.trim()) form.append('text', request.text);
    if (request.file) form.append('file', request.file, request.file.name);
    if (request.startDate) form.append('startDate', request.startDate);
    form.append('sprintLengthDays', String(request.sprintLengthDays));
    form.append('capacityPerSprint', String(request.capacityPerSprint));

    return this.http
      .post<{ plan: AiPlan }>(`${this.api}/projects/${projectId}/ai/plan`, form, {
        context: new HttpContext().set(SKIP_ERROR_TOAST, true),
      })
      .pipe(map(({ plan }) => plan));
  }

  /** Creates the reviewed plan: PLANNED sprints and TODO tasks, all or nothing. */
  apply(projectId: string, input: ApplyPlanInput): Observable<ApplyPlanResult> {
    return this.http.post<ApplyPlanResult>(
      `${this.api}/projects/${projectId}/ai/plan/apply`,
      input,
    );
  }
}
