import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Observable, Subject, of, throwError } from 'rxjs';

import { apiErrorInterceptor } from '../../../core/http/api-error.interceptor';
import { Retrospective, RetrospectiveResult } from '../../../core/models/ai-retrospective';
import { ApiError } from '../../../core/models/api-error';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { testTask } from '../../../testing/test-data';
import { AiRetrospectiveService } from '../ai-retrospective.service';
import { RetrospectiveDialog, RetrospectiveDialogData } from './retrospective-dialog';

const retro = (overrides: Partial<Retrospective> = {}): Retrospective => ({
  id: 'r1',
  sprint: {
    id: 's1',
    name: 'Sprint 2',
    status: 'COMPLETED',
    startDate: '2026-10-01',
    endDate: '2026-10-14',
  },
  method: 'llm',
  model: 'gemini-3.5-flash-lite',
  summary: 'Sprint 2 delivered 2 of 4 tasks (8 of 18 points, 44%).',
  delivered: ['Login page'],
  slipped: ['Payment API (blocked: waiting for the bank)'],
  blockers: [],
  wentWell: ['The login page was delivered'],
  toImprove: ['Only 44% of the points were delivered'],
  actions: [
    {
      id: 'a1',
      title: 'Get the bank sandbox access',
      description: 'The payment API was blocked.',
      type: 'DEVOPS',
      priority: 'HIGH',
      task: null,
    },
    {
      id: 'a2',
      title: 'Commit to about 8 points',
      description: '',
      type: 'IMPROVEMENT',
      priority: 'MEDIUM',
      task: 't9',
    },
  ],
  metrics: {
    totalTasks: 4,
    doneTasks: 2,
    totalPoints: 18,
    donePoints: 8,
    completionRate: 0.444,
    durationDays: 14,
    velocity: 0.57,
    historicalVelocity: 1,
    velocityChange: -0.43,
    blockedTasks: 1,
    blockedDuringSprint: 2,
    addedAfterStart: 1,
    lateTasks: 1,
    unassignedOpen: 1,
  },
  warnings: [],
  generatedBy: { id: 'u1', firstName: 'Sara', lastName: 'Manager' },
  createdAt: '2026-10-14T18:00:00.000Z',
  updatedAt: '2026-10-14T18:00:00.000Z',
  ...overrides,
});

describe('RetrospectiveDialog', () => {
  let fixture: ComponentFixture<RetrospectiveDialog>;
  let service: Record<'get' | 'generate' | 'createTask', ReturnType<typeof vi.fn>>;
  let confirm: ReturnType<typeof vi.fn>;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  async function render(
    saved: Observable<RetrospectiveResult>,
    data: Partial<RetrospectiveDialogData> = {},
  ) {
    service = {
      get: vi.fn(() => saved),
      generate: vi.fn(() => of({ retrospective: retro() })),
      createTask: vi.fn(),
    };
    confirm = vi.fn(() => of(true));
    toast = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      imports: [RetrospectiveDialog],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            sprintId: 's1',
            sprintName: 'Sprint 2',
            canEdit: true,
            openSprints: [
              { id: 's2', name: 'Sprint 3', status: 'ACTIVE' },
              { id: 's3', name: 'Sprint 4', status: 'PLANNED' },
            ],
            ...data,
          },
        },
        { provide: AiRetrospectiveService, useValue: service },
        { provide: ConfirmService, useValue: { confirm } },
        { provide: ToastService, useValue: toast },
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
      ],
    });
    fixture = TestBed.createComponent(RetrospectiveDialog);
    await fixture.whenStable();
  }

  const element = () => fixture.nativeElement as HTMLElement;
  const text = () => (element().textContent ?? '').replace(/\s+/g, ' ');
  const button = (label: string) =>
    [...element().querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.includes(label) || b.getAttribute('aria-label')?.startsWith(label),
    );

  it('shows the figures, the summary, the sections and the actions', async () => {
    await render(of({ retrospective: retro() }));

    expect(service.get).toHaveBeenCalledWith('s1');
    expect(text()).toContain('Written by AI (gemini-3.5-flash-lite) from the sprint figures');
    // Each figure: the value, then its label.
    const figures = [...element().querySelectorAll('.figures li')].map((li) =>
      [...li.children]
        .map((child) => (child.textContent ?? '').replace(/\s+/g, ' ').trim())
        .join(' '),
    );
    expect(figures).toEqual([
      '2 / 4 tasks done',
      '44% 8 / 18 points',
      '0.57 points / day (-43%)',
      '2 blocked',
    ]);
    expect(text()).toContain('Sprint 2 delivered 2 of 4 tasks');
    const sections = [...element().querySelectorAll('section')].map((s) =>
      s.querySelector('h3 mat-icon')?.nextSibling?.textContent?.trim(),
    );
    expect(sections).toEqual([
      'Delivered',
      'Not finished',
      'What went well',
      'What to improve',
      'Actions for the next sprint',
    ]); // no empty "What slowed the team down"
    const actions = [...element().querySelectorAll('.action')];
    expect(actions[0].textContent).toContain('DevOps');
    expect(actions[0].textContent).toContain('High');
    expect(actions[1].textContent).toContain('Task created');
    expect(button('Create a task: Commit')).toBeUndefined();
    expect(button('Regenerate')).toBeDefined();
  });

  it('is read-only for the other members of the project', async () => {
    await render(of({ retrospective: retro({ method: 'local', model: null }) }), {
      canEdit: false,
    });
    expect(text()).toContain('Built from the sprint figures (no language model)');
    expect(button('Create a task')).toBeUndefined();
    expect(button('Regenerate')).toBeUndefined();
  });

  it('generates the retrospective at once after the sprint is completed', async () => {
    const pending = new Subject<RetrospectiveResult>();
    await render(of({ retrospective: null }), { generate: true });
    expect(service.generate).toHaveBeenCalledWith('s1');

    TestBed.resetTestingModule();
    await render(of({ retrospective: null }), { generate: true });
    service.generate.mockReturnValue(pending);
    // Re-run with a pending answer to see the progress state.
    fixture.componentInstance['run']();
    await fixture.whenStable();
    expect(text()).toContain('The AI is reviewing the sprint');
    pending.next({ retrospective: retro() });
    pending.complete();
    await fixture.whenStable();
    expect(text()).toContain('Sprint 2 delivered 2 of 4 tasks');
  });

  it('offers to generate it when there is none, and confirms a regeneration', async () => {
    await render(of({ retrospective: null }));
    expect(service.generate).not.toHaveBeenCalled();
    expect(text()).toContain('No retrospective yet for this sprint.');

    button('Generate the retrospective')!.click();
    await fixture.whenStable();
    expect(confirm).not.toHaveBeenCalled();
    expect(service.generate).toHaveBeenCalledTimes(1);

    button('Regenerate')!.click();
    await fixture.whenStable();
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Regenerate the retrospective?' }),
    );
    expect(service.generate).toHaveBeenCalledTimes(2);
  });

  it('creates a task from an action in the next planned sprint or the backlog', async () => {
    await render(of({ retrospective: retro() }));
    const done = retro({ actions: retro().actions.map((a) => ({ ...a, task: 't10' })) });
    service.createTask.mockReturnValue(
      of({ task: testTask({ title: 'Get the bank sandbox access' }), retrospective: done }),
    );

    button('Create a task: Get the bank')!.click();
    await fixture.whenStable();
    expect(service.createTask).toHaveBeenCalledWith('s1', 'a1', 's3'); // the PLANNED sprint first
    expect(toast.success).toHaveBeenCalledWith(
      'Task «Get the bank sandbox access» created in «Sprint 4».',
    );
    expect(element().querySelectorAll('.created')).toHaveLength(2);

    TestBed.resetTestingModule();
    await render(of({ retrospective: retro() }), { openSprints: [] });
    service.createTask.mockReturnValue(
      throwError(
        () => new ApiError(409, 'CONFLICT', 'A task has already been created from this action'),
      ),
    );
    button('Create a task: Get the bank')!.click();
    await fixture.whenStable();
    expect(service.createTask).toHaveBeenCalledWith('s1', 'a1', null);
    expect(toast.error).toHaveBeenCalledWith('A task has already been created from this action');
  });

  it('shows a failure and retries the same request', async () => {
    await render(of({ retrospective: null }), { generate: true });
    service.generate.mockReturnValue(
      throwError(() => new ApiError(504, 'AI_TIMEOUT', 'The AI service did not answer in time')),
    );
    fixture.componentInstance['run']();
    await fixture.whenStable();
    expect(text()).toContain('The AI service did not answer in time');

    service.generate.mockReturnValue(of({ retrospective: retro() }));
    button('Try again')!.click();
    await fixture.whenStable();
    expect(text()).toContain('Sprint 2 delivered 2 of 4 tasks');
  });
});

describe('AiRetrospectiveService', () => {
  it('reads and generates without global toast, and creates a task from an action', () => {
    const toastError = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: ToastService, useValue: { error: toastError } },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const service = TestBed.inject(AiRetrospectiveService);

    service.get('s1').subscribe({ error: () => undefined });
    http
      .expectOne({ method: 'GET', url: '/api/v1/sprints/s1/ai/retrospective' })
      .flush({ error: { code: 'X', message: 'down' } }, { status: 500, statusText: 'Error' });
    service.generate('s1').subscribe({ error: () => undefined });
    http
      .expectOne({ method: 'POST', url: '/api/v1/sprints/s1/ai/retrospective' })
      .flush(
        { error: { code: 'AI_TIMEOUT', message: 'late' } },
        { status: 504, statusText: 'Timeout' },
      );
    expect(toastError).not.toHaveBeenCalled();

    service.createTask('s1', 'a1', null).subscribe();
    const create = http.expectOne('/api/v1/sprints/s1/ai/retrospective/actions/a1/task');
    expect(create.request.body).toEqual({ sprint: null });
    create.flush({ task: testTask(), retrospective: retro() });
    http.verify();
  });
});
