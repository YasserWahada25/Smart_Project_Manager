import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/models/api-error';
import { Sprint } from '../../../core/models/sprint';
import { User } from '../../../core/models/user';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { fakeAuthService, testProject, testSprint, testUser } from '../../../testing/test-data';
import { ProjectContext } from '../../projects/project-context';
import { SprintFormDialog } from '../sprint-form-dialog/sprint-form-dialog';
import { SprintService } from '../sprint.service';
import { SprintList } from './sprint-list';

describe('SprintList', () => {
  let fixture: ComponentFixture<SprintList>;
  let sprintService: Record<'list' | 'setStatus' | 'delete', ReturnType<typeof vi.fn>>;
  let confirm: { confirm: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let dialog: { open: ReturnType<typeof vi.fn> };

  const sprints = [
    testSprint({ id: 's1', name: 'Sprint 1', status: 'COMPLETED' }),
    testSprint({ id: 's2', name: 'Sprint 2', status: 'ACTIVE' }),
    testSprint({ id: 's3', name: 'Sprint 3', status: 'PLANNED', objective: '' }),
  ];

  async function render(user: User = testUser(), list: Sprint[] = sprints) {
    sprintService = { list: vi.fn(() => of(list)), setStatus: vi.fn(), delete: vi.fn() };
    confirm = { confirm: vi.fn(() => of(true)) };
    toast = { success: vi.fn(), error: vi.fn() };
    dialog = { open: vi.fn() };
    TestBed.configureTestingModule({
      imports: [SprintList],
      providers: [
        provideRouter([]),
        ProjectContext,
        { provide: AuthService, useValue: fakeAuthService(user) },
        { provide: SprintService, useValue: sprintService },
        { provide: ConfirmService, useValue: confirm },
        { provide: ToastService, useValue: toast },
        { provide: MatDialog, useValue: dialog },
      ],
    });
    TestBed.inject(ProjectContext).project.set(testProject());
    fixture = TestBed.createComponent(SprintList);
    await fixture.whenStable();
  }

  const element = () => fixture.nativeElement as HTMLElement;
  const cards = () => [...element().querySelectorAll('mat-card')];
  const button = (card: Element, label: string) =>
    [...card.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.includes(label) || b.getAttribute('aria-label')?.startsWith(label),
    );

  it('shows the sprints with their dates, progress and task counts', async () => {
    await render();

    expect(sprintService.list).toHaveBeenCalledWith('p1');
    expect(cards()).toHaveLength(3);
    const second = cards()[1].textContent ?? '';
    expect(second).toContain('Sprint 2');
    expect(second).toContain('Active');
    expect(second).toContain('Oct 5, 2026');
    expect(second).toContain('Oct 18, 2026');
    expect(second).toContain('Authentication and catalog');
    expect(second).toContain('5 / 10 points (50%)');
    expect(second).toContain('3 tasks · 1 done');
    expect(second).toContain('1 blocked');
    expect(cards()[1].querySelector('a')?.getAttribute('href')).toBe('/tasks?sprint=s2');
  });

  it('offers the actions allowed by the sprint status to the project manager', async () => {
    await render();
    const [completed, active, planned] = cards();

    expect(button(completed, 'Edit')).toBeUndefined();
    expect(button(completed, 'Cancel')).toBeUndefined();
    expect(button(active, 'Complete')).toBeDefined();
    expect(button(active, 'Start')).toBeUndefined();
    expect(button(active, 'Delete')).toBeUndefined();
    expect(button(planned, 'Start')).toBeDefined();
    expect(button(planned, 'Delete')).toBeDefined();
    expect(element().textContent).toContain('New sprint');
  });

  it('is read-only for the other users', async () => {
    await render(testUser({ id: 'd1', role: 'DEVELOPER' }));

    expect(element().textContent).not.toContain('New sprint');
    expect(button(cards()[2], 'Start')).toBeUndefined();
    expect(cards()[2].querySelector('a')).not.toBeNull();
  });

  it('starts a sprint without confirmation; a refusal is reported', async () => {
    await render();
    sprintService.setStatus.mockReturnValueOnce(
      throwError(
        () => new ApiError(409, 'CONFLICT', 'The project already has an active sprint: Sprint 2'),
      ),
    );

    button(cards()[2], 'Start')!.click();
    await fixture.whenStable();

    expect(confirm.confirm).not.toHaveBeenCalled();
    expect(sprintService.setStatus).toHaveBeenCalledWith('s3', 'ACTIVE');
    expect(toast.error).toHaveBeenCalledWith('The project already has an active sprint: Sprint 2');
  });

  it('completes, cancels and deletes after confirmation, then reloads', async () => {
    await render();
    sprintService.setStatus.mockReturnValue(
      of(testSprint({ name: 'Sprint 2', status: 'COMPLETED' })),
    );
    sprintService.delete.mockReturnValue(of(undefined));

    button(cards()[1], 'Complete')!.click();
    await fixture.whenStable();
    expect(confirm.confirm).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'Complete this sprint?' }),
    );
    expect(sprintService.setStatus).toHaveBeenLastCalledWith('s2', 'COMPLETED');
    expect(toast.success).toHaveBeenLastCalledWith('Sprint "Sprint 2": Completed.');

    button(cards()[2], 'Cancel')!.click();
    await fixture.whenStable();
    expect(confirm.confirm).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'Cancel this sprint?', destructive: true }),
    );
    expect(sprintService.setStatus).toHaveBeenLastCalledWith('s3', 'CANCELLED');

    button(cards()[2], 'Delete')!.click();
    await fixture.whenStable();
    expect(confirm.confirm).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'Delete this sprint?' }),
    );
    expect(sprintService.delete).toHaveBeenCalledWith('s3');
    expect(sprintService.list).toHaveBeenCalledTimes(4);
  });

  it('opens the sprint form to create or edit, then reloads', async () => {
    await render();
    dialog.open.mockReturnValue({ afterClosed: () => of(testSprint({ name: 'Sprint 4' })) });

    [...element().querySelectorAll('button')]
      .find((b) => b.textContent?.includes('New sprint'))!
      .click();
    await fixture.whenStable();

    expect(dialog.open).toHaveBeenCalledWith(
      SprintFormDialog,
      expect.objectContaining({ data: { projectId: 'p1', sprint: undefined } }),
    );
    expect(toast.success).toHaveBeenCalledWith('The sprint "Sprint 4" has been created.');
    expect(sprintService.list).toHaveBeenCalledTimes(2);

    button(cards()[2], 'Edit')!.click();
    expect(dialog.open.mock.lastCall![1].data.sprint.id).toBe('s3');
  });

  it('explains an empty list', async () => {
    await render(testUser(), []);

    expect(element().textContent).toContain('No sprint yet.');
    expect(element().textContent).toContain('Create a sprint to plan the work of the team.');
  });
});
