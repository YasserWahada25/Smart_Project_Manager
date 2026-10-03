import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';

import { apiErrorInterceptor } from '../../../core/http/api-error.interceptor';
import {
  DeveloperRecommendation,
  RecommendationResult,
} from '../../../core/models/ai-recommendation';
import { ApiError } from '../../../core/models/api-error';
import { ToastService } from '../../../core/services/toast.service';
import { testTask } from '../../../testing/test-data';
import { TaskService } from '../../tasks/task.service';
import { AiRecommendationService } from '../ai-recommendation.service';
import { RecommendDialog } from './recommend-dialog';

function recommendation(overrides: Partial<DeveloperRecommendation> = {}): DeveloperRecommendation {
  return {
    developer: {
      id: 'd1',
      firstName: 'Youssef',
      lastName: 'Alami',
      email: 'y@a.c',
      jobTitle: 'Full-stack',
    },
    score: 86,
    matchingSkills: ['Angular'],
    missingSkills: ['Node.js'],
    openTasks: 1,
    openPoints: 5,
    similarCompletedTasks: 2,
    breakdown: { skills: 0.5, workload: 0.75, experience: 0.4 },
    explanation: 'Has 1 of 2 skills: Angular (expert); missing Node.js.',
    isAssignee: false,
    ...overrides,
  };
}

function result(overrides: Partial<RecommendationResult> = {}): RecommendationResult {
  return {
    task: { id: 't1', title: 'Implement login page', requiredSkills: ['Angular', 'Node.js'] },
    method: 'scoring',
    model: 'transparent scoring v1',
    skillsSource: 'required',
    skills: ['Angular', 'Node.js'],
    recommendations: [
      recommendation(),
      recommendation({
        developer: { id: 'd2', firstName: 'Lina', lastName: 'Ben', email: 'l@b.c', jobTitle: '' },
        score: 40,
        isAssignee: true,
      }),
    ],
    warnings: ['No member has all the skills of the task; nobody has: Node.js.'],
    ...overrides,
  };
}

describe('RecommendDialog', () => {
  let fixture: ComponentFixture<RecommendDialog>;
  let recommend: ReturnType<typeof vi.fn>;
  let setAssignee: ReturnType<typeof vi.fn>;
  let close: ReturnType<typeof vi.fn>;
  let toast: { error: ReturnType<typeof vi.fn> };

  async function render(response = of(result())) {
    recommend = vi.fn(() => response);
    setAssignee = vi.fn();
    close = vi.fn();
    toast = { error: vi.fn() };
    TestBed.configureTestingModule({
      imports: [RecommendDialog],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { taskId: 't1', taskTitle: 'Implement login page' } },
        { provide: MatDialogRef, useValue: { close } },
        { provide: AiRecommendationService, useValue: { recommend } },
        { provide: TaskService, useValue: { setAssignee } },
        { provide: ToastService, useValue: toast },
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
      ],
    });
    fixture = TestBed.createComponent(RecommendDialog);
    await fixture.whenStable();
  }

  const element = () => fixture.nativeElement as HTMLElement;
  const text = () => (element().textContent ?? '').replace(/\s+/g, ' ');

  it('shows the ranking with scores, skills, explanation and warnings', async () => {
    await render();

    expect(recommend).toHaveBeenCalledWith('t1');
    expect(text()).toContain('For «Implement login page»');
    expect(text()).toContain('Score = 60 % skills + 25 % workload + 15 % experience.');
    expect(text()).toContain('Skills compared: Angular, Node.js.');
    expect(text()).toContain('nobody has: Node.js.');
    const items = [...element().querySelectorAll('.candidate')];
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('Youssef Alami');
    expect(items[0].textContent).toContain('86');
    expect(items[0].querySelector('.match')?.textContent).toBe('Angular');
    expect(items[0].querySelector('.missing')?.textContent).toContain('Node.js');
    expect(items[0].textContent).toContain('Has 1 of 2 skills');
    expect(items[1].textContent).toContain('Current assignee');
    expect(items[1].querySelector('button')).toBeNull();
  });

  it('assigns a developer and closes with the updated task', async () => {
    await render();
    const assigned = testTask({
      assignee: { id: 'd1', firstName: 'Youssef', lastName: 'Alami', email: 'y@a.c' },
    });
    setAssignee.mockReturnValue(of(assigned));

    element().querySelector<HTMLButtonElement>('[aria-label="Assign to Youssef Alami"]')!.click();
    await fixture.whenStable();

    expect(setAssignee).toHaveBeenCalledWith('t1', 'd1');
    expect(close).toHaveBeenCalledWith(assigned);
  });

  it('reports a refused assignment without closing', async () => {
    await render();
    setAssignee.mockReturnValue(
      throwError(
        () => new ApiError(400, 'VALIDATION_ERROR', 'The assignee account is deactivated'),
      ),
    );

    element().querySelector<HTMLButtonElement>('[aria-label="Assign to Youssef Alami"]')!.click();
    await fixture.whenStable();

    expect(toast.error).toHaveBeenCalledWith('The assignee account is deactivated');
    expect(close).not.toHaveBeenCalled();
  });

  it('shows the AI error with a retry', async () => {
    await render(
      throwError(() => new ApiError(503, 'AI_UNAVAILABLE', 'The AI service is unavailable')),
    );
    expect(text()).toContain('The AI service is unavailable');

    recommend.mockReturnValue(of(result({ recommendations: [], warnings: [] })));
    [...element().querySelectorAll('button')]
      .find((b) => b.textContent?.includes('Try again'))!
      .click();
    await fixture.whenStable();
    expect(text()).toContain('No developer to recommend.');
  });
});

describe('AiRecommendationService', () => {
  it('calls GET /tasks/:id/ai/recommendations without the global error toast', () => {
    const toastError = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: ToastService, useValue: { error: toastError } },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    let error: unknown;
    TestBed.inject(AiRecommendationService)
      .recommend('t1')
      .subscribe({ error: (e) => (error = e) });

    const req = http.expectOne('/api/v1/tasks/t1/ai/recommendations');
    expect(req.request.method).toBe('GET');
    req.flush(
      { error: { code: 'AI_UNAVAILABLE', message: 'The AI service is unavailable' } },
      { status: 503, statusText: 'Service Unavailable' },
    );
    expect((error as ApiError).status).toBe(503);
    expect(toastError).not.toHaveBeenCalled();
    http.verify();
  });
});
