import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { Observable, Subject, of, throwError } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { apiErrorInterceptor } from '../../../core/http/api-error.interceptor';
import { AssistantConversation, AssistantReply } from '../../../core/models/ai-assistant';
import { ApiError } from '../../../core/models/api-error';
import { AiStatus } from '../../../core/models/system-status';
import { User } from '../../../core/models/user';
import { HealthService } from '../../../core/services/health.service';
import { ToastService } from '../../../core/services/toast.service';
import { fakeAuthService, testProject, testUser } from '../../../testing/test-data';
import { ProjectContext } from '../../projects/project-context';
import { AiAssistantService } from '../ai-assistant.service';
import { AssistantPage } from './assistant-page';

const READY: AiStatus = {
  available: true,
  llm: { provider: 'openai', configured: true, model: 'gpt-4o-mini' },
};
const NO_KEY: AiStatus = {
  available: true,
  llm: { provider: 'openai', configured: false, model: null },
};

const reply = (overrides: Partial<AssistantReply> = {}): AssistantReply => ({
  reply: 'One task is late: «Login page».',
  proposals: [],
  toolsUsed: ['list_tasks'],
  model: 'gpt-4o-mini',
  ...overrides,
});

const PROPOSAL = {
  id: 'p-1',
  tool: 'assign_task' as const,
  arguments: { taskId: 't1', assigneeId: 'd1' },
  summary: 'Assign «Login page» to Youssef Alami',
};

describe('AssistantPage', () => {
  let fixture: ComponentFixture<AssistantPage>;
  let conversation: ReturnType<typeof vi.fn>;
  let chat: ReturnType<typeof vi.fn>;
  let apply: ReturnType<typeof vi.fn>;
  let dismiss: ReturnType<typeof vi.fn>;
  let clear: ReturnType<typeof vi.fn>;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  async function render(
    options: {
      status?: Observable<AiStatus>;
      user?: User;
      archived?: boolean;
      saved?: Observable<AssistantConversation>;
    } = {},
  ) {
    chat = vi.fn(() => of(reply()));
    apply = vi.fn();
    dismiss = vi.fn(() => of({}));
    clear = vi.fn(() => of(undefined));
    conversation = vi.fn(() => options.saved ?? of({ messages: [] }));
    toast = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      imports: [AssistantPage],
      providers: [
        ProjectContext,
        { provide: AuthService, useValue: fakeAuthService(options.user ?? testUser()) },
        {
          provide: AiAssistantService,
          useValue: { chat, apply, dismiss, clear, conversation },
        },
        { provide: HealthService, useValue: { checkAi: () => options.status ?? of(READY) } },
        { provide: ToastService, useValue: toast },
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
      ],
    });
    TestBed.inject(ProjectContext).project.set(
      testProject({ status: options.archived ? 'ARCHIVED' : 'ACTIVE' }),
    );
    fixture = TestBed.createComponent(AssistantPage);
    await fixture.whenStable();
  }

  const element = () => fixture.nativeElement as HTMLElement;
  const text = () => (element().textContent ?? '').replace(/\s+/g, ' ');
  const textarea = () => element().querySelector('textarea')!;
  const button = (label: string) =>
    [...element().querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.includes(label) || b.getAttribute('aria-label')?.startsWith(label),
    );

  async function say(message: string) {
    textarea().value = message;
    textarea().dispatchEvent(new Event('input'));
    textarea().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();
  }

  async function click(label: string) {
    button(label)!.click();
    await fixture.whenStable();
  }

  it('explains what the assistant does and offers suggestions', async () => {
    await render();
    expect(text()).toContain('applied only when you click Confirm');
    expect(text()).toContain('It never deletes anything.');

    await click('Which tasks are late or blocked?');
    expect(chat).toHaveBeenCalledWith('p1', [
      { role: 'user', content: 'Which tasks are late or blocked?' },
    ]);
  });

  it('is unavailable without an LLM key or AI service', async () => {
    await render({ status: of(NO_KEY) });
    expect(text()).toContain('The assistant needs an LLM API key');
    expect(button('Send')!.disabled).toBe(true);

    TestBed.resetTestingModule();
    await render({ status: throwError(() => new Error('down')) });
    expect(text()).toContain('The AI service is not available');
  });

  it('sends the question with Enter, shows the answer and keeps the history', async () => {
    await render();
    const pending = new Subject<AssistantReply>();
    chat.mockReturnValueOnce(pending);

    await say('  Which tasks are late?  ');
    expect(text()).toContain('The assistant is reading the project');
    expect(textarea().value).toBe('');
    pending.next(reply());
    pending.complete();
    await fixture.whenStable();

    const messages = [...element().querySelectorAll('.message')];
    expect(messages.map((m) => m.querySelector('.author')?.textContent)).toEqual([
      'You',
      'Assistant',
    ]);
    expect(messages[1].textContent).toContain('One task is late: «Login page».');

    chat.mockReturnValueOnce(of(reply({ reply: 'Youssef.' })));
    await say('Who should take it?');
    expect(chat).toHaveBeenLastCalledWith('p1', [
      { role: 'user', content: 'Which tasks are late?' },
      { role: 'assistant', content: 'One task is late: «Login page».' },
      { role: 'user', content: 'Who should take it?' },
    ]);
  });

  it('applies a proposal only after confirmation, and tells the assistant what happened', async () => {
    await render();
    chat.mockReturnValueOnce(
      of(reply({ reply: 'I prepared the assignment.', proposals: [PROPOSAL] })),
    );
    apply.mockReturnValue(
      of({ tool: 'assign_task', message: '«Login page» assigned to Youssef Alami.' }),
    );

    await say('Assign the login page to Youssef');
    expect(apply).not.toHaveBeenCalled();
    expect(text()).toContain('Assign «Login page» to Youssef Alami');

    await click('Confirm: Assign');
    expect(apply).toHaveBeenCalledWith('p1', PROPOSAL);
    expect(toast.success).toHaveBeenCalledWith('«Login page» assigned to Youssef Alami.');
    expect(text()).toContain('Applied — «Login page» assigned to Youssef Alami.');
    expect(button('Confirm: Assign')).toBeUndefined();

    await say('Thanks');
    expect(chat.mock.lastCall![1][1]).toEqual({
      role: 'assistant',
      content:
        'I prepared the assignment.\n[Confirmed and applied by the manager: Assign «Login page» to Youssef Alami]',
    });
  });

  it('dismisses a proposal, and shows a refused one', async () => {
    await render();
    const second = { ...PROPOSAL, id: 'p-2', summary: 'Move «Login page» from To do to Done' };
    chat.mockReturnValueOnce(of(reply({ proposals: [PROPOSAL, second] })));
    apply.mockReturnValue(
      throwError(() => new ApiError(409, 'CONFLICT', 'Invalid status transition: TODO → DONE')),
    );

    await say('Do it');
    await click('Dismiss: Assign');
    expect(dismiss).toHaveBeenCalledWith('p1', 'p-1');
    expect(text()).toContain('Dismissed');
    await click('Confirm: Move');
    expect(text()).toContain('Not applied — Invalid status transition: TODO → DONE');
  });

  it('shows an error and gives the question back', async () => {
    await render();
    chat.mockReturnValueOnce(
      throwError(() => new ApiError(504, 'AI_TIMEOUT', 'The AI service did not answer in time')),
    );

    await say('Summarize the sprint');
    expect(text()).toContain('The AI service did not answer in time');
    expect(element().querySelectorAll('.message')).toHaveLength(0);
    expect(textarea().value).toBe('Summarize the sprint');
  });

  it('starts a new conversation (the saved one is deleted)', async () => {
    await render();
    await say('Hello');
    await click('New conversation');
    expect(clear).toHaveBeenCalledWith('p1');
    expect(element().querySelectorAll('.message')).toHaveLength(0);
  });

  it('loads the saved conversation back, with the outcome of each proposal', async () => {
    const saved = new Subject<AssistantConversation>();
    await render({ saved });
    expect(conversation).toHaveBeenCalledWith('p1');
    expect(text()).toContain('Loading the conversation');
    expect(text()).not.toContain('Try:');
    expect(button('Send')!.disabled).toBe(true);

    saved.next({
      messages: [
        { role: 'user', content: 'Assign the login page', proposals: [], createdAt: '2026-10-04' },
        {
          role: 'assistant',
          content: 'Two changes to confirm.',
          createdAt: '2026-10-04',
          proposals: [
            { ...PROPOSAL, state: 'APPLIED', result: '«Login page» assigned.' },
            { ...PROPOSAL, id: 'p-2', summary: 'Create the task «Cart»', state: 'PENDING' },
          ],
        },
      ],
    });
    saved.complete();
    await fixture.whenStable();

    expect(element().querySelectorAll('.message')).toHaveLength(2);
    expect(text()).toContain('Applied — «Login page» assigned.');
    expect(button('Confirm: Assign')).toBeUndefined();
    expect(button('Confirm: Create')).toBeDefined();

    await say('Thanks');
    expect(chat.mock.lastCall![1]).toEqual([
      { role: 'user', content: 'Assign the login page' },
      {
        role: 'assistant',
        content:
          'Two changes to confirm.\n[Confirmed and applied by the manager: Assign «Login page» to Youssef Alami]',
      },
      { role: 'user', content: 'Thanks' },
    ]);
  });

  it('says when the saved conversation cannot be loaded', async () => {
    await render({ saved: throwError(() => new Error('down')) });
    expect(text()).toContain('The previous conversation could not be loaded.');
    expect(text()).toContain('Try:');
  });

  it('is reserved to the manager of an active project', async () => {
    await render({ user: testUser({ id: 'd1', role: 'DEVELOPER' }) });
    expect(text()).toContain('available to the manager of an active project');
    expect(element().querySelector('textarea')).toBeNull();
    expect(conversation).not.toHaveBeenCalled();

    TestBed.resetTestingModule();
    await render({ archived: true });
    expect(element().querySelector('textarea')).toBeNull();
  });
});

describe('AiAssistantService', () => {
  it('posts the conversation (no global toast), the confirmed proposal and manages the saved conversation', () => {
    const toastError = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: ToastService, useValue: { error: toastError } },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const service = TestBed.inject(AiAssistantService);

    let error: unknown;
    service.chat('p1', [{ role: 'user', content: 'Hi' }]).subscribe({ error: (e) => (error = e) });
    const chatRequest = http.expectOne('/api/v1/projects/p1/ai/assistant/chat');
    expect(chatRequest.request.body).toEqual({ messages: [{ role: 'user', content: 'Hi' }] });
    chatRequest.flush(
      { error: { code: 'LLM_NOT_CONFIGURED', message: 'The assistant needs an OpenAI API key' } },
      { status: 503, statusText: 'Service Unavailable' },
    );
    expect((error as ApiError).code).toBe('LLM_NOT_CONFIGURED');
    expect(toastError).not.toHaveBeenCalled();

    service.apply('p1', PROPOSAL).subscribe();
    const applyRequest = http.expectOne('/api/v1/projects/p1/ai/assistant/actions');
    expect(applyRequest.request.body).toEqual({ proposalId: 'p-1' });
    applyRequest.flush({ tool: 'assign_task', message: 'ok' });

    service.conversation('p1').subscribe({ error: () => undefined });
    http
      .expectOne({ method: 'GET', url: '/api/v1/projects/p1/ai/assistant/conversation' })
      .flush({ error: { code: 'X', message: 'down' } }, { status: 500, statusText: 'Error' });
    expect(toastError).not.toHaveBeenCalled();

    service.clear('p1').subscribe();
    http
      .expectOne({ method: 'DELETE', url: '/api/v1/projects/p1/ai/assistant/conversation' })
      .flush(null, { status: 204, statusText: 'No Content' });
    service.dismiss('p1', 'p-1').subscribe();
    http
      .expectOne({ method: 'POST', url: '/api/v1/projects/p1/ai/assistant/proposals/p-1/dismiss' })
      .flush({ id: 'p-1', state: 'DISMISSED' });
    http.verify();
  });
});
