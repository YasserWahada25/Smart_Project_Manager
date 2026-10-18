import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { AssignedTask } from '../../../core/models/task';
import { Role } from '../../../core/models/user';
import { testDashboard, testIndicators } from '../../../testing/dashboard-data';
import {
  fakeAuthService,
  testPage,
  testRisk,
  testTask,
  testUser,
} from '../../../testing/test-data';
import { AiRiskService } from '../../ai-risk/ai-risk.service';
import { CommandPaletteService } from '../../command-palette/command-palette.service';
import { DashboardService } from '../../dashboard/dashboard.service';
import { TaskService } from '../../tasks/task.service';
import { MyWork } from './my-work';

const assigned = (overrides: Partial<AssignedTask>): AssignedTask => ({
  ...testTask(),
  project: { id: 'p1', name: 'E-commerce platform', status: 'ACTIVE' },
  sprint: null,
  ...overrides,
});

describe('MyWork', () => {
  let fixture: ComponentFixture<MyWork>;
  let openPalette: ReturnType<typeof vi.fn>;
  let assignedTasks: ReturnType<typeof vi.fn>;

  async function render(role: Role, dashboard = of(testDashboard())) {
    openPalette = vi.fn();
    assignedTasks = vi.fn(() =>
      of(
        testPage([
          assigned({
            id: 'a1',
            title: 'Fix the login bug',
            isOverdue: true,
            deadline: '2026-09-20T00:00:00.000Z',
          }),
          assigned({ id: 'a2', title: 'Write the tests', status: 'IN_PROGRESS' }),
          assigned({ id: 'a3', title: 'Old task', status: 'DONE' }),
        ]),
      ),
    );
    TestBed.configureTestingModule({
      imports: [MyWork],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: fakeAuthService(testUser({ role })) },
        { provide: DashboardService, useValue: { get: () => dashboard } },
        { provide: TaskService, useValue: { assigned: assignedTasks } },
        { provide: CommandPaletteService, useValue: { open: openPalette } },
        { provide: AiRiskService, useValue: { risk: () => of(testRisk()) } },
      ],
    });
    fixture = TestBed.createComponent(MyWork);
    await fixture.whenStable();
  }

  const element = () => fixture.nativeElement as HTMLElement;
  const text = () => (element().textContent ?? '').replace(/\s+/g, ' ');
  const figures = () =>
    [...element().querySelectorAll('.figures li')].map(
      (li) =>
        `${li.querySelector('.value')?.textContent?.trim()} ${li.querySelector('.label')?.textContent?.trim()}`,
    );

  it("shows a developer's figures and open tasks, overdue ones highlighted", async () => {
    await render(
      'DEVELOPER',
      of(
        testDashboard({
          myTasks: testIndicators({ total: 5, completed: 2, overdue: 1, blocked: 0 }),
        }),
      ),
    );

    expect(assignedTasks).toHaveBeenCalledWith({ page: 1, limit: 20 });
    expect(figures()).toEqual(['3 My open tasks', '1 Overdue', '0 Blocked', '1 Active sprints']);
    const rows = [...element().querySelectorAll('.tasks li')];
    expect(rows.map((row) => row.querySelector('a')?.textContent?.trim())).toEqual([
      'Fix the login bug',
      'Write the tests',
    ]);
    expect(rows[0].classList).toContain('overdue');
    expect(rows[0].textContent).toContain('overdue');
    expect(rows[0].querySelector('a')?.getAttribute('href')).toBe('/projects/p1/tasks/a1');
    expect(text()).toContain('All my tasks');
    expect(text()).not.toContain('New project');
  });

  it("shows a manager's active sprints with their AI risk", async () => {
    await render('PROJECT_MANAGER');

    expect(assignedTasks).not.toHaveBeenCalled();
    expect(text()).toContain('Active sprints');
    expect(element().querySelectorAll('app-active-sprint-card')).toHaveLength(1);
    expect(text()).toContain('Delay risk (AI): High (82%)');
    expect(text()).toContain('New project');
  });

  it('opens the command palette from the quick search', async () => {
    await render('PROJECT_MANAGER');
    element().querySelector<HTMLButtonElement>('.quick-search')!.click();
    expect(openPalette).toHaveBeenCalled();
  });

  it('explains empty lists and loading failures', async () => {
    await render(
      'PROJECT_MANAGER',
      of(testDashboard({ sprints: { active: 0, activeSprints: [] } })),
    );
    expect(text()).toContain('No active sprint.');

    TestBed.resetTestingModule();
    await render(
      'DEVELOPER',
      throwError(() => new Error('down')),
    );
    expect(text()).toContain('Your figures could not be loaded.');
  });
});
