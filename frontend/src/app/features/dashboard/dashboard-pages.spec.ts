import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/models/api-error';
import { DashboardData } from '../../core/models/dashboard';
import { fakeAuthService, testProject, testRisk, testUser } from '../../testing/test-data';
import { AiRiskService } from '../ai-risk/ai-risk.service';
import { ProjectContext } from '../projects/project-context';
import { DashboardPage } from './dashboard-page/dashboard-page';
import { DashboardService } from './dashboard.service';
import {
  testDashboard,
  testIndicators,
  testProjectDashboard,
  testWorkloadRow,
} from '../../testing/dashboard-data';
import { ProjectDashboard } from './project-dashboard/project-dashboard';

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

/** Key figures as "value label" (the two spans of a tile are not separated by spaces). */
function kpis(root: HTMLElement): string[] {
  return [...root.querySelectorAll('.kpis li')].map((tile) =>
    [...tile.querySelectorAll('span')].map((span) => span.textContent?.trim()).join(' '),
  );
}

describe('DashboardPage', () => {
  let fixture: ComponentFixture<DashboardPage>;
  let get: ReturnType<typeof vi.fn>;

  async function render(data: DashboardData | Error) {
    get = vi.fn(() => (data instanceof Error ? throwError(() => data) : of(data)));
    TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [
        provideRouter([]),
        { provide: DashboardService, useValue: { get } },
        { provide: AiRiskService, useValue: { risk: () => of(testRisk()) } },
      ],
    });
    fixture = TestBed.createComponent(DashboardPage);
    await fixture.whenStable();
  }

  const text = () => (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ') ?? '';
  const headings = () =>
    [...(fixture.nativeElement as HTMLElement).querySelectorAll('h2')].map((h) => h.textContent);

  it('shows the indicators, charts, active sprints and workload of a project manager', async () => {
    await render(testDashboard({ workload: [testWorkloadRow()] }));

    expect(text()).toContain('The projects you manage.');
    expect(kpis(fixture.nativeElement)).toEqual([
      '2 projects (1 active)',
      '1 active sprints',
      '6 tasks',
      '2 done',
      '1 blocked',
      '1 overdue',
    ]);
    expect(headings()).toEqual(['Overview', 'Tasks', 'Active sprints', 'Team workload']);
    expect(text()).toContain('Sprint 1');
    expect(text()).toContain('Youssef Alami');
  });

  it("shows a developer's own tasks first", async () => {
    await render(
      testDashboard({ role: 'DEVELOPER', myTasks: testIndicators({ total: 4, completed: 1 }) }),
    );

    expect(headings()[0]).toBe('My tasks');
    expect(kpis(fixture.nativeElement).slice(0, 4)).toEqual([
      '3 open',
      '1 done',
      '1 blocked',
      '1 overdue',
    ]);
    expect(text()).toContain('The projects you are a member of, and your tasks.');
    expect(headings()).not.toContain('Team workload');
  });

  it('shows the accounts of the platform to an administrator', async () => {
    await render(
      testDashboard({
        role: 'ADMIN',
        workload: [],
        platform: {
          users: {
            total: 5,
            active: 4,
            inactive: 1,
            byRole: { ADMIN: 1, PROJECT_MANAGER: 1, DEVELOPER: 3 },
          },
        },
      }),
    );

    expect(headings()).toContain('Accounts');
    expect(kpis(fixture.nativeElement)).toEqual(
      expect.arrayContaining(['5 accounts', '4 active', '1 deactivated', '3 Developer']),
    );
  });

  it('shows an error with a retry button', async () => {
    await render(new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server.'));
    expect(text()).toContain('Cannot reach the server.');

    get.mockReturnValue(of(testDashboard()));
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('app-error-state button')!
      .click();
    await fixture.whenStable();

    expect(kpis(fixture.nativeElement)).toContain('2 projects (1 active)');
  });
});

describe('ProjectDashboard', () => {
  async function render(data = testProjectDashboard()) {
    const forProject = vi.fn(() => of(data));
    TestBed.configureTestingModule({
      imports: [ProjectDashboard],
      providers: [
        provideRouter([]),
        ProjectContext,
        { provide: AuthService, useValue: fakeAuthService(testUser()) },
        { provide: DashboardService, useValue: { forProject } },
        { provide: AiRiskService, useValue: { risk: () => of(testRisk()) } },
      ],
    });
    TestBed.inject(ProjectContext).project.set(testProject());
    const fixture = TestBed.createComponent(ProjectDashboard);
    await fixture.whenStable();
    return { fixture, forProject };
  }

  it('shows the deadline, the team, the tasks, the sprints and the workload of every member', async () => {
    const { fixture, forProject } = await render();
    const text = (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ');

    expect(forProject).toHaveBeenCalledWith('p1');
    expect(kpis(fixture.nativeElement).slice(0, 2)).toEqual([
      '120 days left deadline',
      '2 members',
    ]);
    expect(text).toContain('2 sprints · 0 planned · 1 active · 1 completed · 0 cancelled');
    expect(text).toContain('Sprint 1');
    expect(text).toContain('Youssef Alami');
    expect(text).toContain('Lina Ben');
  });

  it('handles a project without deadline nor active sprint', async () => {
    const data = testProjectDashboard();
    const { fixture } = await render({
      ...data,
      project: { ...data.project, deadline: undefined, daysRemaining: null },
      sprints: { ...data.sprints, activeSprint: null },
    });
    const text = (fixture.nativeElement as HTMLElement).textContent;

    expect(text).toContain('Not set');
    expect(text).toContain('No sprint in progress.');
  });
});
