import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/models/api-error';
import { Project } from '../../../core/models/project';
import { User } from '../../../core/models/user';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { fakeAuthService, testMember, testProject, testUser } from '../../../testing/test-data';
import { AddMembersDialog, AddMembersDialogData } from '../add-members-dialog/add-members-dialog';
import { ProjectContext } from '../project-context';
import { ProjectService } from '../project.service';
import { ProjectOverview } from './project-overview';

describe('ProjectOverview', () => {
  let fixture: ComponentFixture<ProjectOverview>;
  let removeMember: ReturnType<typeof vi.fn>;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let dialog: { open: ReturnType<typeof vi.fn> };

  async function render(
    project: Project = testProject({ members: [testMember()] }),
    user: User = testUser(),
  ) {
    removeMember = vi.fn();
    toast = { success: vi.fn(), error: vi.fn() };
    dialog = { open: vi.fn() };
    TestBed.configureTestingModule({
      imports: [ProjectOverview],
      providers: [
        ProjectContext,
        { provide: AuthService, useValue: fakeAuthService(user) },
        { provide: ProjectService, useValue: { removeMember } },
        { provide: ConfirmService, useValue: { confirm: () => of(true) } },
        { provide: ToastService, useValue: toast },
        { provide: MatDialog, useValue: dialog },
      ],
    });
    TestBed.inject(ProjectContext).project.set(project);
    fixture = TestBed.createComponent(ProjectOverview);
    await fixture.whenStable();
  }

  const element = () => fixture.nativeElement as HTMLElement;
  const text = () => element().textContent ?? '';
  const addButton = () =>
    [...element().querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Add developers'),
    );

  it('shows the overview and the team', async () => {
    await render();

    expect(text()).toContain('Online shop with Stripe payment');
    expect(text()).toContain('October 1, 2026');
    expect(text()).toContain('January 31, 2027');
    expect(text()).toContain('Sara Manager');
    expect(text()).toContain('Node.js');
    expect(text()).toContain('1 member');
    expect(text()).toContain('Youssef Alami');
    expect(text()).toContain('Full-stack developer');
    expect(text()).toContain('Advanced');
  });

  it('lets only the project manager manage the team', async () => {
    await render();
    expect(addButton()).toBeDefined();
    expect(
      element().querySelector('[aria-label="Remove Youssef Alami from the team"]'),
    ).not.toBeNull();

    TestBed.resetTestingModule();
    await render(testProject({ members: [testMember()] }), testUser({ id: 'a1', role: 'ADMIN' }));
    expect(addButton()).toBeUndefined();
    expect(element().querySelector('[aria-label^="Remove"]')).toBeNull();

    TestBed.resetTestingModule();
    await render(testProject({ members: [testMember()], status: 'ARCHIVED' }));
    expect(addButton()).toBeUndefined();
  });

  it('removes a member after confirmation; a refusal is reported', async () => {
    await render();
    const remove = () =>
      element()
        .querySelector<HTMLButtonElement>('[aria-label="Remove Youssef Alami from the team"]')!
        .click();

    const unfinished = 'This member still has 1 unfinished task(s) assigned: reassign them first';
    removeMember.mockReturnValueOnce(throwError(() => new ApiError(409, 'CONFLICT', unfinished)));
    remove();
    await fixture.whenStable();
    expect(toast.error).toHaveBeenCalledWith(unfinished);
    expect(text()).toContain('Youssef Alami');

    removeMember.mockReturnValueOnce(of(testProject()));
    remove();
    await fixture.whenStable();

    expect(removeMember).toHaveBeenLastCalledWith('p1', 'd1');
    expect(toast.success).toHaveBeenCalledWith('Youssef Alami has been removed from the team.');
    expect(text()).toContain('No developer in the team yet.');
  });

  it('opens the developer search and shows the developers added from it', async () => {
    await render();

    addButton()!.click();

    expect(dialog.open).toHaveBeenCalledWith(AddMembersDialog, expect.anything());
    const data = dialog.open.mock.lastCall![1].data as AddMembersDialogData;
    expect(data.project.id).toBe('p1');

    data.onAdded(
      testProject({
        members: [testMember(), testMember({ id: 'd2', firstName: 'Lina', lastName: 'Ben' })],
      }),
    );
    await fixture.whenStable();

    expect(text()).toContain('Lina Ben');
    expect(text()).toContain('2 members');
  });
});
