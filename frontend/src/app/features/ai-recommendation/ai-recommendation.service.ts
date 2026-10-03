import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../../core/http/api-error.interceptor';
import { RecommendationResult } from '../../core/models/ai-recommendation';

/** AI-02: developers of the project ranked for a task (manager only, enforced by the backend). */
@Injectable({ providedIn: 'root' })
export class AiRecommendationService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  /** The dialog shows every error itself (AI unavailable…): no global toast. */
  recommend(taskId: string): Observable<RecommendationResult> {
    return this.http.get<RecommendationResult>(`${this.api}/tasks/${taskId}/ai/recommendations`, {
      context: new HttpContext().set(SKIP_ERROR_TOAST, true),
    });
  }
}
