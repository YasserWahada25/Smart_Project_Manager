import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../../core/http/api-error.interceptor';
import {
  AssistantActionResult,
<<<<<<< HEAD
=======
  AssistantConversation,
>>>>>>> 1703821937e40442e522b5f7a255b6c3c63d056b
  AssistantMessage,
  AssistantProposal,
  AssistantReply,
} from '../../core/models/ai-assistant';

<<<<<<< HEAD
/** AI-04: chat with the assistant of a project, then apply the changes the manager confirms. */
=======
/**
 * AI-04: chat with the assistant of a project, then apply the changes the manager confirms. The backend
 * saves the conversation (one per manager and project) and the outcome of each proposal.
 */
>>>>>>> 1703821937e40442e522b5f7a255b6c3c63d056b
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

<<<<<<< HEAD
  apply(projectId: string, proposal: AssistantProposal): Observable<AssistantActionResult> {
    return this.http.post<AssistantActionResult>(
      `${this.api}/projects/${projectId}/ai/assistant/actions`,
      { tool: proposal.tool, arguments: proposal.arguments },
=======
  /** The saved proposal is applied (its stored tool and arguments) and its outcome recorded. */
  apply(projectId: string, proposal: AssistantProposal): Observable<AssistantActionResult> {
    return this.http.post<AssistantActionResult>(
      `${this.api}/projects/${projectId}/ai/assistant/actions`,
      { proposalId: proposal.id },
    );
  }

  /** The page explains a loading failure itself: no global toast. */
  conversation(projectId: string): Observable<AssistantConversation> {
    return this.http.get<AssistantConversation>(
      `${this.api}/projects/${projectId}/ai/assistant/conversation`,
      { context: new HttpContext().set(SKIP_ERROR_TOAST, true) },
    );
  }

  clear(projectId: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/projects/${projectId}/ai/assistant/conversation`);
  }

  dismiss(projectId: string, proposalId: string): Observable<unknown> {
    return this.http.post(
      `${this.api}/projects/${projectId}/ai/assistant/proposals/${proposalId}/dismiss`,
      {},
>>>>>>> 1703821937e40442e522b5f7a255b6c3c63d056b
    );
  }
}
