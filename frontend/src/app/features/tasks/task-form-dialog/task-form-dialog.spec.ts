import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSelectHarness } from '@angular/material/select/testing';
import { of, throwError } from 'rxjs';

import { ApiError } from '../../../core/models/api-error';
import { testMember, testSprint, testTask } from '../../../testing/test-data';
import { TaskService } from '../task.service';
import { TaskFormData, TaskFormDialog } from './task-form-dialog';

describe('TaskFormDialog', () => {
  let fixture: ComponentFixture<TaskFormDialog>;
  let loader: HarnessLoader;
  let taskService: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let close: ReturnType<typeof vi.fn>;

  const sprints = [
    testSprint({ id: 's1', name: 'Sprint 1', status: 'COMPLETED' }),
    testSprint({ id: 's2', name: 'Sprint 2', status: 'ACTIVE' }),
  ];

  async function render(data: Partial<TaskFormData> = {}) {
    taskService = { create: vi.fn(() => of(testTask())), update: vi.fn(() => of(testTask())) };
    close = vi.fn();
    TestBed.configureTestingModule({
      imports: [TaskFormDialog],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: { projectId: 'p1', sprints, members: [testMember()], ...data },
        },
        { provide: MatDialogRef, useValue: { close } },
        { provide: TaskService, useValue: taskService },
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
      ],
    });
    fixture = TestBed.createComponent(TaskFormDialog);
    loader = TestbedHarnessEnvironment.loader(fixture);
    await fixture.whenStable();
  }

  const element = () => fixture.nativeElement as HTMLElement;
  const select = (name: string) =>
    loader.getHarness(MatSelectHarness.with({ selector: `[formControlName="${name}"]` }));

  async function type(selector: string, value: string) {
    const input = element().querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  async function submit() {
    element().querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  it('creates a task in the pre-selected sprint, assigned to a member', async () => {
    await render({ sprintId: 's2' });

    await type('[formControlName="title"]', '  Login page ');
    const assignee = await select('assignee');
    await assignee.open();
    await assignee.clickOptions({ text: 'Youssef Alami' });
    await type('input[placeholder="Add a skill…"]', 'Angular');
    element()
      .querySelector('input[placeholder="Add a skill…"]')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13 }));
    await submit();

    expect(taskService.create).toHaveBeenCalledWith('p1', {
      title: 'Login page',
      description: '',
      // Defaults of a new task.
      type: 'FEATURE',
      priority: 'MEDIUM',
      complexity: 3,
      deadline: null,
      requiredSkills: ['Angular'],
      sprint: 's2',
      assignee: 'd1',
    });
    expect(close).toHaveBeenCalledWith(testTask());
  });

  it('only offers open sprints (and the backlog) for a new task', async () => {
    await render();

    const sprint = await select('sprint');
    await sprint.open();
    const options = await sprint.getOptions();

    expect(await Promise.all(options.map((option) => option.getText()))).toEqual([
      'Backlog (no sprint)',
      'Sprint 2 (Active)',
    ]);
  });

  it('edits a task: fields filled, no assignee field, the closed sprint of the task kept', async () => {
    await render({ task: testTask({ sprint: 's1' }) });

    expect(element().querySelector('h2')?.textContent).toBe('Edit the task');
    expect(element().querySelector('[formControlName="assignee"]')).toBeNull();
    expect(await (await select('sprint')).getValueText()).toBe('Sprint 1 (Completed)');

    await type('[formControlName="deadline"]', '');
    await submit();

    expect(taskService.update).toHaveBeenCalledWith('t1', {
      title: 'Implement login page',
      description: 'Reactive form + JWT',
      type: 'FEATURE',
      priority: 'HIGH',
      complexity: 5,
      deadline: null,
      requiredSkills: ['Angular'],
      sprint: 's1',
    });
  });

  it('validates the title and shows backend errors', async () => {
    await render();
    taskService.create.mockReturnValue(
      throwError(
        () =>
          new ApiError(400, 'BAD_REQUEST', 'Validation failed', [
            { field: 'assignee', message: 'The assignee account is deactivated' },
          ]),
      ),
    );

    await submit();
    expect(element().textContent).toContain('Title is required');
    expect(taskService.create).not.toHaveBeenCalled();

    await type('[formControlName="title"]', 'Login');
    await submit();
    expect(element().textContent).toContain('The assignee account is deactivated');
    expect(close).not.toHaveBeenCalled();
  });
});
