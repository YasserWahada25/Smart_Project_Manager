import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSelectHarness } from '@angular/material/select/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import type { MockInstance } from 'vitest';

import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/models/api-error';
import { Task } from '../../../core/models/task';
import { User } from '../../../core/models/user';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../shared/components/confirm-dialog/confirm-dialog';
import {
  fakeAuthService,
  testMember,
  testProject,
  testPage,
  testSprint,
  testTask,
  testUser,
} from '../../../testing/test-data';
import { ActivityService } from '../../activity/activity.service';
import { CommentService } from '../../comments/comment.service';
import { ProjectContext } from '../../projects/project-context';
import { SprintService } from '../../sprints/sprint.service';
import { TaskFormDialog } from '../task-form-dialog/task-form-dialog';
import { TaskWorkflow } from '../task-workflow';
import { TaskService } from '../task.service';
import { TaskDetail } from './task-detail';

describe('TaskDetail', () => {
  let fixture: ComponentFixture<TaskDetail>;
  let loader: HarnessLoader;
  let taskService: Record<'get' | 'setAssignee' | 'delete', ReturnType<typeof vi.fn>>;
  let move: MockInstance<TaskWorkflow['move']>;
  let dialog: { open: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  async function render(task: Task = testTask(), user: User = testUser()) {
    taskService = { get: vi.fn(() => of(task)), setAssignee: vi.fn(), delete: vi.fn() };
    dialog = { open: vi.fn() };
    toast = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      imports: [TaskDetail],
      providers: [
        provideRouter([]),
        ProjectContext,
        { provide: AuthService, useValue: fakeAuthService(user) },
        { provide: TaskService, useValue: taskService },
        { provide: SprintService, useValue: { list: () => of([testSprint()]) } },
        { provide: CommentService, useValue: { list: () => of(testPage([])) } },
        { provide: ActivityService, useValue: { forTask: () => of(testPage([])) } },
        { provide: ConfirmService, useValue: { confirm: () => of(true) } },
        { provide: MatDialog, useValue: dialog },
        { provide: ToastService, useValue: toast },
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
      ],
    });
    // Real workflow rules (targets, assignee required); only the status change is stubbed.
    move = vi.spyOn(TestBed.inject(TaskWorkflow), 'move');
    TestBed.inject(ProjectContext).project.set(
      testProject({
        members: [testMember(), testMember({ id: 'd2', firstName: 'Lina', lastName: 'Ben' })],
      }),
    );
    fixture = TestBed.createComponent(TaskDetail);
    fixture.componentRef.setInput('taskId', 't1');
    loader = TestbedHarnessEnvironment.loader(fixture);
    await fixture.whenStable();
  }

  const element = () => fixture.nativeElement as HTMLElement;
  const text = () => element().textContent ?? '';
  const moveButtons = () => [...element().querySelectorAll<HTMLButtonElement>('.workflow button')];

  it('shows the task', async () => {
    await render();

    expect(taskService.get).toHaveBeenCalledWith('t1');
    expect(element().querySelector('h2')?.textContent).toBe('Implement login page');
    expect(text()).toContain('To do');
    expect(text()).toContain('High');
    expect(text()).toContain('Feature');
    expect(text()).toContain('5 points');
    expect(text()).toContain('Reactive form + JWT');
    expect(text()).toContain('Angular');
    expect(text()).toContain('Sprint 1');
    expect(text()).toContain('November 15, 2026');
    expect(text()).toContain('Sara Manager');
    expect(element().querySelector('a.back')?.getAttribute('href')).toBe('/projects/p1/tasks');
  });

  it('offers the allowed moves; starting needs an assignee', async () => {
    await render(testTask({ assignee: null }));

    expect(moveButtons().map((b) => b.textContent?.trim())).toEqual(['In progress', 'Blocked']);
    expect(moveButtons()[0].disabled).toBe(true);
    expect(moveButtons()[1].disabled).toBe(false);
    expect(text()).toContain('Assign the task to a developer before starting it.');
  });

  it('moves the task through the workflow and shows the new status', async () => {
    await render();
    move.mockReturnValue(of(testTask({ status: 'IN_PROGRESS' })));

    moveButtons()[0].click();
    await fixture.whenStable();

    expect(move).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }), 'IN_PROGRESS');
    expect(text()).toContain('In progress');
    expect(moveButtons().map((b) => b.textContent?.trim())).toEqual([
      'To do',
      'Code review',
      'Blocked',
    ]);
  });

  it('shows the comments and the history of the task', async () => {
    await render();

    expect(text()).toContain('Comments');
    expect(text()).toContain('No comment yet.');
    expect(text()).toContain('History');
    expect(text()).toContain('No history yet.');
  });

  it('shows why a task is blocked', async () => {
    await render(testTask({ status: 'BLOCKED', blockedReason: 'Waiting for the API' }));

    expect(text()).toContain('Blocked: Waiting for the API');
  });

  it('lets the assignee move the task but not edit it; other members only read', async () => {
    await render(testTask(), testUser({ id: 'd1', role: 'DEVELOPER' }));
    expect(moveButtons()).toHaveLength(2);
    expect(element().querySelector('[aria-label="Delete the task"]')).toBeNull();
    expect(element().querySelector('mat-select')).toBeNull();
    expect(text()).toContain('Youssef Alami');

    TestBed.resetTestingModule();
    await render(testTask(), testUser({ id: 'd2', role: 'DEVELOPER' }));
    expect(moveButtons()).toHaveLength(0);
  });

  it('assigns the task (project manager); a refusal restores the previous assignee', async () => {
    await render();
    taskService.setAssignee.mockReturnValueOnce(
      of(testTask({ assignee: { id: 'd2', firstName: 'Lina', lastName: 'Ben', email: 'l@b.c' } })),
    );
    const assignee = await loader.getHarness(MatSelectHarness);

    await assignee.open();
    await assignee.clickOptions({ text: 'Lina Ben' });
    expect(taskService.setAssignee).toHaveBeenCalledWith('t1', 'd2');
    expect(toast.success).toHaveBeenCalledWith('"Implement login page" assigned to Lina Ben.');

    taskService.setAssignee.mockReturnValueOnce(
      throwError(
        () =>
          new ApiError(
            409,
            'CONFLICT',
            'A task in IN_PROGRESS must keep an assignee: move it back to TODO first',
          ),
      ),
    );
    await assignee.open();
    await assignee.clickOptions({ text: 'Unassigned' });

    expect(taskService.setAssignee).toHaveBeenLastCalledWith('t1', null);
    expect(toast.error).toHaveBeenCalledWith(
      'A task in IN_PROGRESS must keep an assignee: move it back to TODO first',
    );
    expect(await assignee.getValueText()).toBe('Lina Ben');
  });

  it('edits the task in the form dialog', async () => {
    await render();
    dialog.open.mockReturnValue({ afterClosed: () => of(testTask({ title: 'Login page v2' })) });

    [...element().querySelectorAll('button')].find((b) => b.textContent?.includes('Edit'))!.click();
    await fixture.whenStable();

    expect(dialog.open).toHaveBeenCalledWith(TaskFormDialog, expect.anything());
    expect(dialog.open.mock.lastCall![1].data.task.id).toBe('t1');
    expect(element().querySelector('h2')?.textContent).toBe('Login page v2');
  });

  it('deletes the task after confirmation and goes back to the list', async () => {
    await render();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    taskService.delete.mockReturnValue(of(undefined));

    element().querySelector<HTMLButtonElement>('[aria-label="Delete the task"]')!.click();
    await fixture.whenStable();

    expect(taskService.delete).toHaveBeenCalledWith('t1');
    expect(toast.success).toHaveBeenCalledWith('The task has been deleted.');
    expect(navigate).toHaveBeenCalledWith(['/projects', 'p1', 'tasks']);
  });
});
