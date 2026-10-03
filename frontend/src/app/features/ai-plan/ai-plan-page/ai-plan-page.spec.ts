import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatMenuHarness } from '@angular/material/menu/testing';
import { Router, provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { AiPlan, ApplyPlanInput } from '../../../core/models/ai-plan';
import { ApiError } from '../../../core/models/api-error';
import { AiStatus } from '../../../core/models/system-status';
import { User } from '../../../core/models/user';
import { HealthService } from '../../../core/services/health.service';
import { ToastService } from '../../../core/services/toast.service';
import { fakeAuthService, testPlan, testProject, testUser } from '../../../testing/test-data';
import { ProjectContext } from '../../projects/project-context';
import { AiPlanService } from '../ai-plan.service';
import { AiPlanPage } from './ai-plan-page';

const LOCAL: AiStatus = {
  available: true,
  llm: { provider: 'openai', configured: false, model: null },
};
const OPENAI: AiStatus = {
  available: true,
  llm: { provider: 'openai', configured: true, model: 'gpt-4o-mini' },
};

describe('AiPlanPage', () => {
  let fixture: ComponentFixture<AiPlanPage>;
  let loader: HarnessLoader;
  let aiPlan: { generate: ReturnType<typeof vi.fn>; apply: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let navigate: ReturnType<typeof vi.spyOn>;

  async function render(
    options: { user?: User; status?: Observable<AiStatus>; archived?: boolean } = {},
  ) {
    aiPlan = { generate: vi.fn(() => of(testPlan())), apply: vi.fn() };
    toast = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      imports: [AiPlanPage],
      providers: [
        provideRouter([]),
        ProjectContext,
        { provide: AuthService, useValue: fakeAuthService(options.user ?? testUser()) },
        { provide: AiPlanService, useValue: aiPlan },
        { provide: HealthService, useValue: { checkAi: () => options.status ?? of(LOCAL) } },
        { provide: ToastService, useValue: toast },
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
      ],
    });
    TestBed.inject(ProjectContext).project.set(
      testProject({ status: options.archived ? 'ARCHIVED' : 'ACTIVE' }),
    );
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(AiPlanPage);
    loader = TestbedHarnessEnvironment.loader(fixture);
    await fixture.whenStable();
  }

  const element = () => fixture.nativeElement as HTMLElement;
  const text = () => (element().textContent ?? '').replace(/\s+/g, ' ');
  const buttonByText = (label: string) =>
    [...element().querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes(label),
    );
  const byLabel = <T extends HTMLElement>(label: string) =>
    element().querySelector<T>(`[aria-label="${label}"]`);

  async function type(target: HTMLInputElement | HTMLTextAreaElement, value: string) {
    target.value = value;
    target.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  async function click(target: HTMLElement | null | undefined) {
    target!.click();
    await fixture.whenStable();
  }

  async function generate(plan: AiPlan = testPlan()) {
    aiPlan.generate.mockReturnValue(of(plan));
    await type(element().querySelector('textarea')!, '# Authentication\n- Sign in with email');
    await click(buttonByText('Generate the plan'));
  }

  function selectFile(file: File) {
    const input = element().querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
  }

  describe('step 1 — specification', () => {
    it('states which analyzer runs and whether the document leaves the servers', async () => {
      await render();
      expect(text()).toContain('Analyzer: local');
      expect(text()).toContain('does not leave your servers');

      TestBed.resetTestingModule();
      await render({ status: of(OPENAI) });
      expect(text()).toContain('Analyzer: OpenAI gpt-4o-mini');
      expect(text()).toContain('The specification is sent to OpenAI');

      TestBed.resetTestingModule();
      await render({
        status: of({
          available: true,
          llm: { provider: 'gemini', configured: true, model: 'gemini-3.8-flash' },
        }),
      });
      expect(text()).toContain('Analyzer: Google Gemini gemini-3.8-flash');
      expect(text()).toContain('The specification is sent to Google Gemini');
    });

    it('cannot generate while the AI service is down', async () => {
      await render({ status: throwError(() => new Error('down')) });

      expect(text()).toContain('The AI service is not available');
      expect(buttonByText('Generate the plan')!.disabled).toBe(true);
    });

    it('requires a specification of 20 characters or a file', async () => {
      await render();
      await type(element().querySelector('textarea')!, 'Too short');
      await click(buttonByText('Generate the plan'));

      expect(aiPlan.generate).not.toHaveBeenCalled();
      expect(text()).toContain(
        'Paste the specification (at least 20 characters) or attach a file.',
      );
    });

    it('checks the file type and size before sending it', async () => {
      await render();
      selectFile(new File(['x'], 'spec.exe'));
      await fixture.whenStable();
      expect(text()).toContain('Unsupported file type: use .txt, .md, .pdf, .docx');

      const big = new File(['x'], 'spec.pdf');
      Object.defineProperty(big, 'size', { value: 6 * 1024 * 1024 });
      selectFile(big);
      await fixture.whenStable();
      expect(text()).toContain('The file exceeds 5 MB');

      selectFile(new File(['# Spec'], 'cahier.docx'));
      await fixture.whenStable();
      expect(text()).toContain('cahier.docx');
      await click(buttonByText('Generate the plan'));

      expect(aiPlan.generate).toHaveBeenCalledWith('p1', {
        text: '',
        file: expect.objectContaining({ name: 'cahier.docx' }),
        startDate: '',
        sprintLengthDays: 14,
        capacityPerSprint: 20,
      });
    });

    it('validates the planning options', async () => {
      await render();
      await type(element().querySelector('textarea')!, 'Users sign in with their email address');
      const [length] = [...element().querySelectorAll<HTMLInputElement>('input[type="number"]')];
      await type(length, '40');
      await click(buttonByText('Generate the plan'));

      expect(aiPlan.generate).not.toHaveBeenCalled();
      expect(text()).toContain('A whole number between 5 and 30');
    });

    it('shows a spinner while the AI works, then the error; the input is kept', async () => {
      await render();
      const pending = new Subject<AiPlan>();
      aiPlan.generate.mockReturnValue(pending);
      await type(element().querySelector('textarea')!, 'Users sign in with their email address');
      await click(buttonByText('Generate the plan'));
      expect(text()).toContain('This can take up to 90 seconds');

      pending.error(new ApiError(504, 'AI_TIMEOUT', 'The AI service did not answer in time'));
      await fixture.whenStable();

      expect(text()).toContain('The AI service did not answer in time');
      expect(element().querySelector('textarea')!.value).toBe(
        'Users sign in with their email address',
      );
    });
  });

  describe('step 2 — review', () => {
    it('shows the proposal: analyzer, stats, warnings, sprints and backlog', async () => {
      await render();
      await generate();

      expect(text()).toContain('local analyzer');
      expect(text()).toContain('Nothing is created until you apply the plan');
      expect(text()).toContain('4 tasks · 2 sprints · 16 points planned');
      expect(text()).toContain('from «cahier.docx»');
      expect(text()).toContain('The project deadline is passed by the last sprint.');
      const names = [
        ...element().querySelectorAll<HTMLInputElement>('input[formcontrolname="name"]'),
      ];
      expect(names.map((input) => input.value)).toEqual(['Sprint 1', 'Sprint 2']);
      expect(text()).toContain('8 / 20 points');
      expect(text()).toContain('Backlog');
      expect(text()).toContain('Dark mode');
      expect(buttonByText('Apply the plan')!.textContent).toContain('4 tasks, 2 sprints');
    });

    it('edits, moves and deletes tasks, then applies the reviewed plan', async () => {
      await render();
      await generate();
      aiPlan.apply.mockReturnValue(
        of({ sprints: [{ id: 's1', name: 'Sprint 1' }], tasksCreated: 3, backlogTasks: 2 }),
      );

      // Edit the first task.
      await click(byLabel('Edit Sign in with email'));
      const title = element().querySelector<HTMLInputElement>('input[formcontrolname="title"]')!;
      await type(title, 'Sign in with email and password');

      // Move "Browse products" to the backlog, delete "Reset the password", remove sprint 2.
      const menu = await loader.getHarness(
        MatMenuHarness.with({ selector: '[aria-label="Move Browse products"]' }),
      );
      await menu.clickItem({ text: 'Backlog' });
      await click(byLabel('Delete Reset the password'));
      await click(byLabel('Remove Sprint 2'));

      await click(buttonByText('Apply the plan'));

      const input = aiPlan.apply.mock.lastCall![1] as ApplyPlanInput;
      expect(aiPlan.apply).toHaveBeenCalledWith('p1', expect.anything());
      expect(input.method).toBe('local');
      expect(input.sprints).toHaveLength(1);
      expect(input.sprints[0]).toMatchObject({
        name: 'Sprint 1',
        objective: 'Authentication',
        startDate: '2026-10-05',
        endDate: '2026-10-18',
      });
      expect(input.sprints[0].tasks.map((task) => task.title)).toEqual([
        'Sign in with email and password',
      ]);
      expect(input.sprints[0].tasks[0]).not.toHaveProperty('epic');
      expect(input.backlog.map((task) => task.title)).toEqual(['Dark mode', 'Browse products']);
      expect(toast.success).toHaveBeenCalledWith('Plan applied: 3 tasks and 1 sprint created.');
      expect(navigate).toHaveBeenCalledWith(['../sprints'], expect.anything());
    });

    it('adds a sprint after the last one', async () => {
      await render();
      await generate();
      await click(buttonByText('Add a sprint'));

      const names = [
        ...element().querySelectorAll<HTMLInputElement>('input[formcontrolname="name"]'),
      ];
      expect(names.at(-1)!.value).toBe('Sprint 3');
      const dates = [...element().querySelectorAll<HTMLInputElement>('input[type="date"]')];
      expect(dates.slice(-2).map((input) => input.value)).toEqual(['2026-11-02', '2026-11-15']);
    });

    it('refuses an invalid plan before sending it', async () => {
      await render();
      await generate();
      await click(byLabel('Edit Sign in with email'));
      await type(element().querySelector<HTMLInputElement>('input[formcontrolname="title"]')!, ' ');
      const endDate = element().querySelectorAll<HTMLInputElement>('input[type="date"]')[1];
      await type(endDate, '2026-10-01');

      await click(buttonByText('Apply the plan'));

      expect(aiPlan.apply).not.toHaveBeenCalled();
      expect(text()).toContain('Some fields need your attention');
      expect(text()).toContain('Title is required');
      expect(text()).toContain('On or after the start date');
    });

    it('shows the backend validation errors on the matching fields', async () => {
      await render();
      await generate();
      aiPlan.apply.mockReturnValue(
        throwError(
          () =>
            new ApiError(400, 'VALIDATION_ERROR', 'Validation failed', [
              { field: 'sprints[0].name', message: 'Sprint name is already used' },
            ]),
        ),
      );

      await click(buttonByText('Apply the plan'));

      expect(text()).toContain('Sprint name is already used');
      expect(navigate).not.toHaveBeenCalled();
    });

    it('goes back to the specification with the input kept', async () => {
      await render();
      await generate();
      await click(buttonByText('Back'));

      expect(element().querySelector('textarea')!.value).toContain('# Authentication');
      expect(buttonByText('Generate the plan')).toBeDefined();
    });
  });

  it('is reserved to the manager of a project that is not archived', async () => {
    await render({ user: testUser({ id: 'd1', role: 'DEVELOPER' }) });
    expect(text()).toContain('Only the project manager can plan');
    expect(buttonByText('Generate the plan')).toBeUndefined();

    TestBed.resetTestingModule();
    await render({ archived: true });
    expect(text()).toContain('Only the project manager can plan');
  });
});
