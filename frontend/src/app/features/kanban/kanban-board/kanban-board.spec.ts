import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatMenuHarness } from '@angular/material/menu/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import type { MockInstance } from 'vitest';

import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/models/api-error';
import { Board, BoardTask, TASK_STATUSES } from '../../../core/models/task';
import { User } from '../../../core/models/user';
import { ToastService } from '../../../core/services/toast.service';
import {
  fakeAuthService,
  testProject,
  testSprint,
  testTask,
  testUser,
} from '../../../testing/test-data';
import { ProjectContext } from '../../projects/project-context';
import { SprintService } from '../../sprints/sprint.service';
import { TaskWorkflow } from '../../tasks/task-workflow';
import { TaskService } from '../../tasks/task.service';
import { KanbanBoard } from './kanban-board';

describe('KanbanBoard', () => {
  let fixture: ComponentFixture<KanbanBoard>;
  let loader: HarnessLoader;
  let board: ReturnType<typeof vi.fn>;
  let move: MockInstance<TaskWorkflow['move']>;

  const todo: BoardTask = testTask();
  const blocked: BoardTask = testTask({
    id: 't2',
    title: 'Payment API',
    status: 'BLOCKED',
    blockedReason: 'Waiting for the Stripe keys',
    assignee: null,
    isOverdue: true,
  });
  const boardOf = (tasks: BoardTask[]): Board => ({
    project: { id: 'p1', name: 'E-commerce platform', status: 'ACTIVE' },
    sprint: { id: 's2', name: 'Sprint 2', status: 'ACTIVE' },
    scope: 'SPRINT',
    totalTasks: tasks.length,
    columns: TASK_STATUSES.map((status) => {
      const inColumn = tasks.filter((task) => task.status === status);
      return { status, count: inColumn.length, tasks: inColumn };
    }),
  });

  async function render(user: User = testUser(), sprintParam: string | null = null) {
    board = vi.fn(() => of(boardOf([todo, blocked])));
    TestBed.configureTestingModule({
      imports: [KanbanBoard],
      providers: [
        provideRouter([]),
        ProjectContext,
        { provide: AuthService, useValue: fakeAuthService(user) },
        { provide: TaskService, useValue: { board } },
        {
          provide: SprintService,
          useValue: {
            list: () =>
              of([
                testSprint({ id: 's1', name: 'Sprint 1', status: 'COMPLETED' }),
                testSprint({ id: 's2', name: 'Sprint 2', status: 'ACTIVE' }),
              ]),
          },
        },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap(sprintParam ? { sprint: sprintParam } : {}),
            },
          },
        },
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
      ],
    });
    TestBed.inject(ProjectContext).project.set(testProject({ status: 'ACTIVE' }));
    move = vi.spyOn(TestBed.inject(TaskWorkflow), 'move');
    fixture = TestBed.createComponent(KanbanBoard);
    loader = TestbedHarnessEnvironment.loader(fixture);
    await fixture.whenStable();
  }

  const element = () => fixture.nativeElement as HTMLElement;
  const column = (status: string) =>
    element().querySelector<HTMLElement>(`section[data-status="${status}"]`)!;

  it('shows the board of the active sprint by default, one column per status', async () => {
    await render();

    expect(board).toHaveBeenCalledWith('p1', 's2');
    expect(
      [...element().querySelectorAll('section h3')].map((h) =>
        h.textContent?.replace(/\s+/g, ' ').trim(),
      ),
    ).toEqual(['To do 1', 'In progress 0', 'Code review 0', 'Testing 0', 'Done 0', 'Blocked 1']);
    expect(element().textContent).toContain('2 tasks');

    const card = column('TODO').querySelector('.card')!;
    expect(card.querySelector('a')?.getAttribute('href')).toBe('/projects/p1/tasks/t1');
    expect(card.textContent).toContain('High');
    expect(card.textContent).toContain('5 pts');
    expect(card.textContent).toContain('Nov 15');
    expect(card.textContent).toContain('Youssef Alami');

    const blockedCard = column('BLOCKED').querySelector('.card')!;
    expect(blockedCard.classList).toContain('overdue');
    expect(blockedCard.textContent).toContain('Waiting for the Stripe keys');
    expect(blockedCard.textContent).toContain('Unassigned');
    expect(column('DONE').textContent).toContain('No task');
  });

  it('opens on the sprint given in the URL, and switches to the backlog or all the tasks', async () => {
    await render(testUser(), 's1');
    expect(board).toHaveBeenCalledWith('p1', 's1');

    const scope = await loader.getHarness(MatSelectHarness);
    await scope.open();
    await scope.clickOptions({ text: 'Backlog (no sprint)' });
    expect(board).toHaveBeenLastCalledWith('p1', 'backlog');

    await scope.open();
    await scope.clickOptions({ text: 'All the tasks' });
    expect(board).toHaveBeenLastCalledWith('p1', undefined);
  });

  it('moves a task to an allowed status (an assignee is required to start), then reloads', async () => {
    await render();
    move.mockReturnValue(of(testTask({ status: 'IN_PROGRESS' })));

    const blockedMenu = await loader.getHarness(
      MatMenuHarness.with({ selector: '[aria-label="Move Payment API"]' }),
    );
    await blockedMenu.open();
    const items = await blockedMenu.getItems();
    const labels = await Promise.all(items.map((item) => item.getText()));
    expect(labels).toEqual(['To do', 'In progress', 'Code review', 'Testing']);
    expect(await items[1].isDisabled()).toBe(true);
    await blockedMenu.close();

    const todoMenu = await loader.getHarness(
      MatMenuHarness.with({ selector: '[aria-label="Move Implement login page"]' }),
    );
    await todoMenu.clickItem({ text: 'In progress' });
    await fixture.whenStable();

    expect(move).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }), 'IN_PROGRESS');
    expect(board).toHaveBeenCalledTimes(2);
  });

  it('lets an assignee move only their own tasks; other members only read', async () => {
    await render(testUser({ id: 'd1', role: 'DEVELOPER' }));
    expect(element().querySelector('[aria-label="Move Implement login page"]')).not.toBeNull();
    expect(element().querySelector('[aria-label="Move Payment API"]')).toBeNull();

    TestBed.resetTestingModule();
    await render(testUser({ id: 'd9', role: 'DEVELOPER' }));
    expect(element().querySelector('[aria-label^="Move"]')).toBeNull();
  });

  it('shows the error with a retry button', async () => {
    await render();
    board.mockReturnValueOnce(throwError(() => new ApiError(404, 'NOT_FOUND', 'Sprint not found')));

    const scope = await loader.getHarness(MatSelectHarness);
    await scope.open();
    await scope.clickOptions({ text: 'Sprint 1 (Completed)' });

    expect(element().textContent).toContain('Sprint not found');
    element().querySelector<HTMLButtonElement>('app-error-state button')!.click();
    await fixture.whenStable();
    expect(column('TODO')).not.toBeNull();
  });
});
