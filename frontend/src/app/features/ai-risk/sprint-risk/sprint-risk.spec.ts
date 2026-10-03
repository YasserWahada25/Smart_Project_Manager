import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';

import { apiErrorInterceptor } from '../../../core/http/api-error.interceptor';
import { SprintRisk } from '../../../core/models/ai-risk';
import { ApiError } from '../../../core/models/api-error';
import { ToastService } from '../../../core/services/toast.service';
import { testRisk } from '../../../testing/test-data';
import { AiRiskService } from '../ai-risk.service';
import { SprintRiskIndicator } from './sprint-risk';

describe('SprintRiskIndicator', () => {
  let fixture: ComponentFixture<SprintRiskIndicator>;
  let risk: ReturnType<typeof vi.fn>;

  async function render(response: Observable<SprintRisk>) {
    risk = vi.fn(() => response);
    TestBed.configureTestingModule({
      imports: [SprintRiskIndicator],
      providers: [{ provide: AiRiskService, useValue: { risk } }],
    });
    fixture = TestBed.createComponent(SprintRiskIndicator);
    fixture.componentRef.setInput('sprintId', 's1');
    await fixture.whenStable();
  }

  const element = () => fixture.nativeElement as HTMLElement;
  const text = () => (element().textContent ?? '').replace(/\s+/g, ' ');

  it('shows the level, the probability and the factors', async () => {
    await render(of(testRisk()));

    expect(risk).toHaveBeenCalledWith('s1');
    expect(text()).toContain('Delay risk (AI): High (82%)');
    expect(element().querySelector('.level')?.getAttribute('data-level')).toBe('HIGH');
    expect([...element().querySelectorAll('.factors li')].map((li) => li.textContent)).toEqual([
      'Behind schedule: 57% of the time elapsed, 20% of the story points done',
      '1 blocked task (50% of the open tasks)',
    ]);
  });

  it('shows a low risk and the warnings', async () => {
    await render(
      of(
        testRisk({
          riskLevel: 'LOW',
          probability: 0.04,
          factors: [],
          warnings: ['No completed sprint yet: the usual pace is estimated from this sprint.'],
        }),
      ),
    );
    expect(text()).toContain('Delay risk (AI): Low (4%)');
    expect(element().querySelector('.factors')).toBeNull();
    expect(text()).toContain('No completed sprint yet');
  });

  it('reloads when the sprint changes', async () => {
    await render(of(testRisk()));
    fixture.componentRef.setInput('sprintId', 's2');
    await fixture.whenStable();
    expect(risk).toHaveBeenLastCalledWith('s2');
  });

  it('stays discreet when the AI service is unavailable', async () => {
    await render(
      throwError(() => new ApiError(503, 'AI_UNAVAILABLE', 'The AI service is unavailable')),
    );
    expect(text()).toContain('Delay risk unavailable: The AI service is unavailable');
  });
});

describe('AiRiskService', () => {
  it('calls GET /sprints/:id/ai/risk without the global error toast', () => {
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
    TestBed.inject(AiRiskService)
      .risk('s1')
      .subscribe({ error: (e) => (error = e) });

    const req = http.expectOne('/api/v1/sprints/s1/ai/risk');
    expect(req.request.method).toBe('GET');
    req.flush(
      { error: { code: 'AI_TIMEOUT', message: 'The AI service did not answer in time' } },
      { status: 504, statusText: 'Gateway Timeout' },
    );
    expect((error as ApiError).status).toBe(504);
    expect(toastError).not.toHaveBeenCalled();
    http.verify();
  });
});
