import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatMenuHarness } from '@angular/material/menu/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
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
import { TaskPanelService } from '../../tasks/task-panel/task-panel';
import { TaskWorkflow } from '../../tasks/task-workflow';
import { TaskService } from '../../tasks/task.service';
import { KanbanBoard } from './kanban-board';

describe('KanbanBoard', () => {
  let fixture: ComponentFixture<KanbanBoard>;
  let loader: HarnessLoader;
  let board: ReturnType<typeof vi.fn>;
  let create: ReturnType<typeof vi.fn>;
  let openPanel: ReturnType<typeof vi.fn>;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
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
    create = vi.fn(() => of(testTask({ id: 't9', title: 'Write the README' })));
    toast = { success: vi.fn(), error: vi.fn() };
    openPanel = vi.fn(() => of(undefined));
    TestBed.configureTestingModule({
      imports: [KanbanBoard],
      providers: [
        provideRouter([]),
        ProjectContext,
        { provide: AuthService, useValue: fakeAuthService(user) },
        { provide: TaskService, useValue: { board, create } },
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
        { provide: ToastService, useValue: toast },
        { provide: TaskPanelService, useValue: { open: openPanel } },
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

  // ---------- drag and drop (UX-2) ----------
  interface DragApi {
    canEnter(drag: { data: BoardTask }, drop: { data: string }): boolean;
    drop(event: {
      item: { data: BoardTask };
      container: { data: string };
      previousContainer: { data: string };
    }): void;
  }
  const api = () => fixture.componentInstance as unknown as DragApi;
  const dropEvent = (task: BoardTask, from: string, to: string) => {
    const previousContainer = { data: from };
    return {
      item: { data: task },
      previousContainer,
      container: from === to ? previousContainer : { data: to },
    };
  };

  it('makes the cards draggable for the manager and the assignee only', async () => {
    await render();
    expect(column('TODO').querySelector('.card')?.classList).toContain('draggable');

    TestBed.resetTestingModule();
    await render(testUser({ id: 'd9', role: 'DEVELOPER' }));
    expect(column('TODO').querySelector('.card')?.classList).not.toContain('draggable');
  });

  it('lets a card enter only the allowed columns (an assignee is needed to start)', async () => {
    await render();
    expect(api().canEnter({ data: todo }, { data: 'IN_PROGRESS' })).toBe(true);
    expect(api().canEnter({ data: todo }, { data: 'TODO' })).toBe(true); // back to its own column
    expect(api().canEnter({ data: todo }, { data: 'DONE' })).toBe(false); // skipped steps
    expect(api().canEnter({ data: blocked }, { data: 'IN_PROGRESS' })).toBe(false); // unassigned
    expect(api().canEnter({ data: blocked }, { data: 'TODO' })).toBe(true);
  });

  it('moves a dropped card at once, saves the move and reloads the board', async () => {
    await render();
    move.mockReturnValue(of(testTask({ status: 'IN_PROGRESS' })));

    api().drop(dropEvent(todo, 'TODO', 'IN_PROGRESS'));
    await fixture.whenStable();

    expect(move).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }), 'IN_PROGRESS');
    expect(board).toHaveBeenCalledTimes(2); // reloaded after the move
  });

  it('shows the card in its new column before the answer, and reloads after a refusal', async () => {
    await render();
    const pending = new Subject<never>();
    move.mockReturnValue(pending);

    api().drop(dropEvent(todo, 'TODO', 'IN_PROGRESS'));
    await fixture.whenStable();
    expect(column('IN_PROGRESS').textContent).toContain('Implement login page');
    expect(column('TODO').textContent).not.toContain('Implement login page');

    pending.complete(); // refused (the workflow shows the message) or blocking reason cancelled
    await fixture.whenStable();

    expect(board).toHaveBeenCalledTimes(2);
    expect(column('TODO').textContent).toContain('Implement login page'); // board reloaded
  });

  it('ignores a drop in the same column or in a forbidden one', async () => {
    await render();
    api().drop(dropEvent(todo, 'TODO', 'TODO'));
    api().drop(dropEvent(todo, 'TODO', 'DONE'));
    expect(move).not.toHaveBeenCalled();
  });

  // ---------- quick add ----------
  const button = (label: string) =>
    [...element().querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes(label),
    );

  it('adds a task from the To do column (manager), in the shown sprint', async () => {
    await render();
    button('Add task')!.click();
    await fixture.whenStable();
    const input = column('TODO').querySelector<HTMLInputElement>('.quick-add input')!;
    input.value = '  Write the README ';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    column('TODO').querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(create).toHaveBeenCalledWith('p1', {
      title: 'Write the README',
      description: '',
      type: 'FEATURE',
      priority: 'MEDIUM',
      complexity: 3,
      deadline: null,
      requiredSkills: [],
      sprint: 's2',
      assignee: null,
    });
    expect(toast.success).toHaveBeenCalledWith('"Write the README" added to To do.');
    expect(board).toHaveBeenCalledTimes(2);
  });

  it('cancels with Escape; no quick add for other members nor in a closed sprint', async () => {
    await render();
    button('Add task')!.click();
    await fixture.whenStable();
    column('TODO')
      .querySelector('.quick-add input')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();
    expect(column('TODO').querySelector('.quick-add')).toBeNull();

    const scope = await loader.getHarness(MatSelectHarness);
    await scope.open();
    await scope.clickOptions({ text: 'Sprint 1 (Completed)' });
    expect(button('Add task')).toBeUndefined();

    TestBed.resetTestingModule();
    await render(testUser({ id: 'd1', role: 'DEVELOPER' }));
    expect(button('Add task')).toBeUndefined();
  });

  // ---------- side panel (UX-3) ----------
  it('opens a card in the side panel (Ctrl+click keeps the full page) and reloads after closing', async () => {
    await render();
    const title = column('TODO').querySelector<HTMLAnchorElement>('.card-title')!;

    title.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    await fixture.whenStable();
    expect(openPanel).toHaveBeenCalledWith({ projectId: 'p1', taskId: 't1' }, expect.anything());
    expect(board).toHaveBeenCalledTimes(2);

    const ctrlClick = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
    title.dispatchEvent(ctrlClick);
    expect(openPanel).toHaveBeenCalledTimes(1);
    expect(title.getAttribute('href')).toBe('/projects/p1/tasks/t1');
  });
});
