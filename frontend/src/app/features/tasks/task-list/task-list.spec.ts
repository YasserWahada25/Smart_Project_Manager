import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSelectHarness } from '@angular/material/select/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { User } from '../../../core/models/user';
import { ToastService } from '../../../core/services/toast.service';
import {
  fakeAuthService,
  testMember,
  testPage,
  testProject,
  testSprint,
  testTask,
  testUser,
} from '../../../testing/test-data';
import { ProjectContext } from '../../projects/project-context';
import { SprintService } from '../../sprints/sprint.service';
import { TaskFormDialog } from '../task-form-dialog/task-form-dialog';
import { TaskService } from '../task.service';
import { TaskList } from './task-list';

describe('TaskList', () => {
  let fixture: ComponentFixture<TaskList>;
  let loader: HarnessLoader;
  let list: ReturnType<typeof vi.fn>;
  let dialog: { open: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn> };

  const tasks = [
    testTask(),
    testTask({
      id: 't2',
      title: 'Fix cart total',
      type: 'BUG',
      status: 'BLOCKED',
      assignee: null,
      sprint: null,
      deadline: '2026-09-01T00:00:00.000Z',
      isOverdue: true,
    }),
  ];

  async function render(user: User = testUser(), sprintParam: string | null = null) {
    list = vi.fn(() => of(testPage(tasks)));
    dialog = { open: vi.fn() };
    toast = { success: vi.fn() };
    TestBed.configureTestingModule({
      imports: [TaskList],
      providers: [
        provideRouter([]),
        ProjectContext,
        { provide: AuthService, useValue: fakeAuthService(user) },
        { provide: TaskService, useValue: { list } },
        { provide: SprintService, useValue: { list: () => of([testSprint()]) } },
        { provide: MatDialog, useValue: dialog },
        { provide: ToastService, useValue: toast },
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
    TestBed.inject(ProjectContext).project.set(testProject({ members: [testMember()] }));
    fixture = TestBed.createComponent(TaskList);
    loader = TestbedHarnessEnvironment.loader(fixture);
    await fixture.whenStable();
  }

  const element = () => fixture.nativeElement as HTMLElement;
  const rows = () => [...element().querySelectorAll('tr[mat-row]')].map((row) => row.textContent);
  const newTaskButton = () =>
    [...element().querySelectorAll('button')].find((b) => b.textContent?.includes('New task'));

  it('lists the tasks with their status, priority, assignee, sprint and deadline', async () => {
    await render();

    expect(list).toHaveBeenCalledWith('p1', expect.objectContaining({ page: 1, limit: 20 }));
    // The link URL (/projects/p1/tasks/t1) is checked by the routing tests (app.spec.ts).
    expect(element().querySelector('a.title')?.textContent).toBe('Implement login page');
    expect(rows()[0]).toContain('To do');
    expect(rows()[0]).toContain('High');
    expect(rows()[0]).toContain('Youssef Alami');
    expect(rows()[0]).toContain('Sprint 1');
    expect(rows()[1]).toContain('Bug');
    expect(rows()[1]).toContain('Blocked');
    expect(rows()[1]).toContain('Backlog');
    expect(rows()[1]).toContain('Overdue');
  });

  it('opens filtered on the sprint given in the URL, and filters by status', async () => {
    await render(testUser(), 's1');
    expect(list).toHaveBeenCalledWith('p1', expect.objectContaining({ sprint: 's1' }));

    const status = await loader.getHarness(
      MatSelectHarness.with({ selector: '[formControlName="status"]' }),
    );
    await status.open();
    await status.clickOptions({ text: 'Blocked' });

    expect(list).toHaveBeenLastCalledWith(
      'p1',
      expect.objectContaining({ sprint: 's1', status: 'BLOCKED', page: 1 }),
    );
  });

  it('lets the project manager create a task (in the filtered sprint), then reloads', async () => {
    await render(testUser(), 's1');
    dialog.open.mockReturnValue({ afterClosed: () => of(testTask({ title: 'New one' })) });

    newTaskButton()!.click();
    await fixture.whenStable();

    expect(dialog.open).toHaveBeenCalledWith(TaskFormDialog, expect.anything());
    const data = dialog.open.mock.lastCall![1].data;
    expect(data.projectId).toBe('p1');
    expect(data.sprintId).toBe('s1');
    expect(data.members.map((member: { id: string }) => member.id)).toEqual(['d1']);
    expect(toast.success).toHaveBeenCalledWith('The task "New one" has been created.');
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('does not offer task creation to members', async () => {
    await render(testUser({ id: 'd1', role: 'DEVELOPER' }));

    expect(newTaskButton()).toBeUndefined();
  });
});
