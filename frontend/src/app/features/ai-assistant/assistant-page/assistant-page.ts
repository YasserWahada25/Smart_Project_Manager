import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { actionErrorMessage } from '../../../core/http/action-error';
import {
  ASSISTANT_LIMITS,
  AssistantMessage,
  AssistantProposal,
  AssistantProposalState,
  SavedAssistantMessage,
} from '../../../core/models/ai-assistant';
import { ApiError } from '../../../core/models/api-error';
import { AiStatus } from '../../../core/models/system-status';
import { HealthService } from '../../../core/services/health.service';
import { ToastService } from '../../../core/services/toast.service';
import { ProjectContext } from '../../projects/project-context';
import { AiAssistantService } from '../ai-assistant.service';

type ProposalState = 'pending' | 'applying' | 'applied' | 'dismissed' | 'failed';

interface ProposalView {
  proposal: AssistantProposal;
  state: ProposalState;
  /** Result or error message once handled. */
  result?: string;
}

interface Entry {
  role: 'user' | 'assistant';
  content: string;
  proposals: ProposalView[];
}

const SUGGESTIONS = [
  'Summarize the progress of the active sprint.',
  'Which tasks are late or blocked?',
  'Who has the lightest workload?',
  'Create a task to write the API documentation.',
];

/**
 * "Assistant" tab (AI-04, manager only): a chat about the project. The assistant reads the project
 * data through the backend; the changes it prepares are shown as proposals and applied only when
 * the manager clicks "Confirm". The backend saves the conversation and the outcome of each proposal: it is
 * loaded back when the manager returns to the page.
 */
@Component({
  selector: 'app-assistant-page',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
  ],
  templateUrl: './assistant-page.html',
  styleUrl: './assistant-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssistantPage {
  private readonly context = inject(ProjectContext);
  private readonly assistantService = inject(AiAssistantService);
  private readonly healthService = inject(HealthService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly suggestions = SUGGESTIONS;
  protected readonly limits = ASSISTANT_LIMITS;
  protected readonly canEdit = this.context.canEdit;
  protected readonly status = signal<AiStatus | null>(null);
  protected readonly available = computed(() => {
    const status = this.status();
    return status === null || (status.available && status.llm?.configured === true);
  });
  protected readonly entries = signal<Entry[]>([]);
  /** The saved conversation is being loaded. */
  protected readonly loading = signal(false);
  protected readonly clearing = signal(false);
  protected readonly thinking = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly question = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(ASSISTANT_LIMITS.messageMaxLength)],
  });

  constructor() {
    this.healthService
      .checkAi()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (status) => this.status.set(status),
        error: () => this.status.set({ available: false, reason: 'UNREACHABLE', llm: null }),
      });
    if (this.canEdit()) this.loadConversation();
  }

  private loadConversation(): void {
    this.loading.set(true);
    this.assistantService
      .conversation(this.context.current.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ messages }) => {
          this.entries.set(messages.map(toEntry));
          this.loading.set(false);
        },
        error: () => {
          this.errorMessage.set('The previous conversation could not be loaded.');
          this.loading.set(false);
        },
      });
  }

  protected unavailableMessage(): string {
    const status = this.status();
    if (status && !status.available) {
      return 'The AI service is not available: the assistant cannot answer for now.';
    }
    return (
      'The assistant needs an LLM API key: set OPENAI_API_KEY (OpenAI, Google Gemini or another ' +
      'OpenAI-compatible provider) in ai-service/.env and restart ' +
      'the AI service. The other AI features keep working with their local models.'
    );
  }

  protected ask(text: string): void {
    this.question.setValue(text);
    this.send();
  }

  /** Enter sends, Shift+Enter adds a line. */
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  protected send(): void {
    const text = this.question.value.trim();
    if (!text || this.thinking() || this.loading() || this.question.invalid || !this.available()) {
      return;
    }
    this.errorMessage.set(null);
    this.entries.update((entries) => [...entries, { role: 'user', content: text, proposals: [] }]);
    this.question.setValue('');
    this.thinking.set(true);

    this.assistantService
      .chat(this.context.current.id, this.history())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (reply) => {
          this.entries.update((entries) => [
            ...entries,
            {
              role: 'assistant',
              content: reply.reply,
              proposals: reply.proposals.map((proposal) => ({ proposal, state: 'pending' })),
            },
          ]);
          this.thinking.set(false);
        },
        error: (error: unknown) => {
          // The question goes back to the field so that it can be sent again.
          this.entries.update((entries) => entries.slice(0, -1));
          this.question.setValue(text);
          this.errorMessage.set(
            error instanceof ApiError ? error.message : 'An unexpected error occurred.',
          );
          this.thinking.set(false);
        },
      });
  }

  protected confirm(view: ProposalView): void {
    this.update(view, { state: 'applying' });
    this.assistantService
      .apply(this.context.current.id, view.proposal)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.update(view, { state: 'applied', result: result.message });
          this.toast.success(result.message);
        },
        error: (error: unknown) => {
          const message =
            actionErrorMessage(error) ??
            (error instanceof ApiError ? error.message : 'The change could not be applied.');
          this.update(view, { state: 'failed', result: message });
        },
      });
  }

  protected dismiss(view: ProposalView): void {
    this.update(view, { state: 'dismissed' });
    this.assistantService
      .dismiss(this.context.current.id, view.proposal.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => this.update(view, { state: 'pending' }) });
  }

  /** Deletes the saved conversation and starts a new one. */
  protected clear(): void {
    this.clearing.set(true);
    this.assistantService
      .clear(this.context.current.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.entries.set([]);
          this.errorMessage.set(null);
          this.clearing.set(false);
        },
        error: () => this.clearing.set(false),
      });
  }

  /**
   * Visible conversation sent to the backend (last 20 messages). The outcome of each proposal is
   * appended to the assistant message so that the assistant knows what was really applied.
   */
  private history(): AssistantMessage[] {
    return this.entries()
      .map((entry): AssistantMessage => {
        const outcomes = entry.proposals.flatMap((view) => {
          const label = OUTCOME_LABELS[view.state];
          return label ? [`[${label}: ${view.proposal.summary}]`] : [];
        });
        const content = [entry.content, ...outcomes]
          .join('\n')
          .slice(0, ASSISTANT_LIMITS.messageMaxLength);
        return { role: entry.role, content };
      })
      .slice(-ASSISTANT_LIMITS.maxMessages);
  }

  private update(target: ProposalView, changes: Partial<ProposalView>): void {
    this.entries.update((entries) =>
      entries.map((entry) => ({
        ...entry,
        proposals: entry.proposals.map((view) =>
          view.proposal.id === target.proposal.id ? { ...view, ...changes } : view,
        ),
      })),
    );
  }
}

const SAVED_STATES: Record<AssistantProposalState, ProposalState> = {
  PENDING: 'pending',
  APPLIED: 'applied',
  DISMISSED: 'dismissed',
  FAILED: 'failed',
};

function toEntry(message: SavedAssistantMessage): Entry {
  return {
    role: message.role,
    content: message.content,
    proposals: message.proposals.map(({ state, result, ...proposal }) => ({
      proposal,
      state: SAVED_STATES[state],
      result,
    })),
  };
}

/** What the assistant is told about each handled proposal (pending ones are not mentioned). */
const OUTCOME_LABELS: Partial<Record<ProposalState, string>> = {
  applied: 'Confirmed and applied by the manager',
  dismissed: 'Dismissed by the manager',
  failed: 'Failed when applied',
};
