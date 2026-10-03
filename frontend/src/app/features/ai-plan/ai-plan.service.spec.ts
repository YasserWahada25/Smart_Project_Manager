import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { apiErrorInterceptor } from '../../core/http/api-error.interceptor';
import { ApiError } from '../../core/models/api-error';
import { ToastService } from '../../core/services/toast.service';
import { testPlan } from '../../testing/test-data';
import { AiPlanService } from './ai-plan.service';

describe('AiPlanService', () => {
  let service: AiPlanService;
  let httpTesting: HttpTestingController;
  let toastError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    toastError = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: ToastService, useValue: { error: toastError } },
      ],
    });
    service = TestBed.inject(AiPlanService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('sends the text, the file and the options as a multipart form', () => {
    const file = new File(['# Spec'], 'cahier.md', { type: 'text/markdown' });
    let received: unknown;
    service
      .generate('p1', {
        text: 'Users sign in with their email',
        file,
        startDate: '2026-10-05',
        sprintLengthDays: 10,
        capacityPerSprint: 25,
      })
      .subscribe((plan) => (received = plan));

    const request = httpTesting.expectOne('/api/v1/projects/p1/ai/plan');
    expect(request.request.method).toBe('POST');
    const body = request.request.body as FormData;
    expect(body.get('text')).toBe('Users sign in with their email');
    expect((body.get('file') as File).name).toBe('cahier.md');
    expect(body.get('startDate')).toBe('2026-10-05');
    expect(body.get('sprintLengthDays')).toBe('10');
    expect(body.get('capacityPerSprint')).toBe('25');
    request.flush({ plan: testPlan() });

    expect(received).toEqual(testPlan());
  });

  it('omits an empty text, the missing file and an automatic start date', () => {
    service
      .generate('p1', {
        text: '  ',
        file: null,
        startDate: '',
        sprintLengthDays: 14,
        capacityPerSprint: 20,
      })
      .subscribe();

    const body = httpTesting.expectOne('/api/v1/projects/p1/ai/plan').request.body as FormData;
    expect(body.has('text')).toBe(false);
    expect(body.has('file')).toBe(false);
    expect(body.has('startDate')).toBe(false);
    httpTesting.expectNone('/api/v1/projects/p1/ai/plan');
  });

  it('leaves AI errors to the page (no global toast)', () => {
    let error: unknown;
    service
      .generate('p1', {
        text: 'x'.repeat(30),
        file: null,
        startDate: '',
        sprintLengthDays: 14,
        capacityPerSprint: 20,
      })
      .subscribe({ error: (e) => (error = e) });

    httpTesting
      .expectOne('/api/v1/projects/p1/ai/plan')
      .flush(
        { error: { code: 'AI_TIMEOUT', message: 'The AI service did not answer in time' } },
        { status: 504, statusText: 'Gateway Timeout' },
      );

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toBe('The AI service did not answer in time');
    expect(toastError).not.toHaveBeenCalled();
  });

  it('posts the reviewed plan as JSON to apply it', () => {
    const input = { method: 'local' as const, sprints: [], backlog: [] };
    let result: unknown;
    service.apply('p1', input).subscribe((value) => (result = value));

    const request = httpTesting.expectOne('/api/v1/projects/p1/ai/plan/apply');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBe(input);
    request.flush({ sprints: [], tasksCreated: 0, backlogTasks: 0 });

    expect(result).toEqual({ sprints: [], tasksCreated: 0, backlogTasks: 0 });
  });
});
