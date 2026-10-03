import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../../core/http/api-error.interceptor';
import { SprintRisk } from '../../core/models/ai-risk';

/** AI-03: delay risk of a planned or active sprint (any project viewer). */
@Injectable({ providedIn: 'root' })
export class AiRiskService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  /** Optional indicator: its failure is shown discreetly by the caller, never as a global toast. */
  risk(sprintId: string): Observable<SprintRisk> {
    return this.http.get<SprintRisk>(`${this.api}/sprints/${sprintId}/ai/risk`, {
      context: new HttpContext().set(SKIP_ERROR_TOAST, true),
    });
  }
}
