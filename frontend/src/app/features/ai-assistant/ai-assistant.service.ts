import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../../core/http/api-error.interceptor';
import {
  AssistantActionResult,
  AssistantMessage,
  AssistantProposal,
  AssistantReply,
} from '../../core/models/ai-assistant';

/** AI-04: chat with the assistant of a project, then apply the changes the manager confirms. */
@Injectable({ providedIn: 'root' })
export class AiAssistantService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  /** The page shows the errors itself (assistant unavailable, timeout…): no global toast. */
  chat(projectId: string, messages: AssistantMessage[]): Observable<AssistantReply> {
    return this.http.post<AssistantReply>(
      `${this.api}/projects/${projectId}/ai/assistant/chat`,
      { messages },
      { context: new HttpContext().set(SKIP_ERROR_TOAST, true) },
    );
  }

  apply(projectId: string, proposal: AssistantProposal): Observable<AssistantActionResult> {
    return this.http.post<AssistantActionResult>(
      `${this.api}/projects/${projectId}/ai/assistant/actions`,
      { tool: proposal.tool, arguments: proposal.arguments },
    );
  }
}
