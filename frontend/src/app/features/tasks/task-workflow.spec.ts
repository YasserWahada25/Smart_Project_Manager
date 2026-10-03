import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';

import { ApiError } from '../../core/models/api-error';
import { Task } from '../../core/models/task';
import { ToastService } from '../../core/services/toast.service';
import { testTask } from '../../testing/test-data';
import { BlockReasonDialog } from './block-reason-dialog/block-reason-dialog';
import { TaskWorkflow } from './task-workflow';
import { TaskService } from './task.service';

describe('TaskWorkflow', () => {
  let workflow: TaskWorkflow;
  let setStatus: ReturnType<typeof vi.fn>;
  let dialog: { open: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    setStatus = vi.fn((id: string, status: Task['status']) => of(testTask({ id, status })));
    dialog = { open: vi.fn() };
    toast = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: TaskService, useValue: { setStatus } },
        { provide: MatDialog, useValue: dialog },
        { provide: ToastService, useValue: toast },
      ],
    });
    workflow = TestBed.inject(TaskWorkflow);
  });

  it('follows the transition table of the backend', () => {
    expect(workflow.targets({ status: 'TODO' })).toEqual(['IN_PROGRESS', 'BLOCKED']);
    expect(workflow.targets({ status: 'TESTING' })).toEqual([
      'IN_PROGRESS',
      'CODE_REVIEW',
      'DONE',
      'BLOCKED',
    ]);
    expect(workflow.targets({ status: 'DONE' })).toEqual(['IN_PROGRESS']);
  });

  it('requires an assignee to work on a task', () => {
    expect(workflow.needsAssignee({ assignee: null }, 'IN_PROGRESS')).toBe(true);
    expect(workflow.needsAssignee({ assignee: null }, 'BLOCKED')).toBe(false);
    expect(workflow.needsAssignee(testTask(), 'IN_PROGRESS')).toBe(false);
  });

  it('moves a task and confirms', () => {
    let result: Task | undefined;
    workflow.move(testTask(), 'IN_PROGRESS').subscribe((task) => (result = task));

    expect(setStatus).toHaveBeenCalledWith('t1', 'IN_PROGRESS', undefined);
    expect(result?.status).toBe('IN_PROGRESS');
    expect(toast.success).toHaveBeenCalledWith('"Implement login page" moved to In progress.');
    expect(dialog.open).not.toHaveBeenCalled();
  });

  it('asks the reason before blocking; cancelling changes nothing', () => {
    dialog.open.mockReturnValueOnce({ afterClosed: () => of('Waiting for the API') });
    workflow.move(testTask(), 'BLOCKED').subscribe();
    expect(dialog.open).toHaveBeenCalledWith(BlockReasonDialog, expect.anything());
    expect(setStatus).toHaveBeenCalledWith('t1', 'BLOCKED', 'Waiting for the API');

    setStatus.mockClear();
    dialog.open.mockReturnValueOnce({ afterClosed: () => of(undefined) });
    workflow.move(testTask(), 'BLOCKED').subscribe();
    expect(setStatus).not.toHaveBeenCalled();
  });

  it('shows the refusal of the backend and emits nothing', () => {
    setStatus.mockReturnValue(
      throwError(() => new ApiError(409, 'CONFLICT', 'Invalid status transition: TODO → DONE')),
    );
    const next = vi.fn();

    workflow.move(testTask(), 'DONE').subscribe(next);

    expect(toast.error).toHaveBeenCalledWith('Invalid status transition: TODO → DONE');
    expect(next).not.toHaveBeenCalled();
  });
});

describe('BlockReasonDialog', () => {
  let fixture: ComponentFixture<BlockReasonDialog>;
  let close: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    close = vi.fn();
    TestBed.configureTestingModule({
      imports: [BlockReasonDialog],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { title: 'Login page' } },
        { provide: MatDialogRef, useValue: { close } },
      ],
    });
    fixture = TestBed.createComponent(BlockReasonDialog);
    await fixture.whenStable();
  });

  const textarea = () => (fixture.nativeElement as HTMLElement).querySelector('textarea')!;
  const blockButton = () =>
    [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Block the task'),
    )!;

  it('returns the trimmed reason, and refuses a too long one', async () => {
    textarea().value = 'x'.repeat(501);
    textarea().dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(blockButton().disabled).toBe(true);

    textarea().value = '  Waiting for the API  ';
    textarea().dispatchEvent(new Event('input'));
    await fixture.whenStable();
    blockButton().click();

    expect(close).toHaveBeenCalledWith('Waiting for the API');
  });
});
