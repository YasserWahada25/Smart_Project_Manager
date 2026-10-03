import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatMenuHarness } from '@angular/material/menu/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/models/api-error';
import { Project } from '../../../core/models/project';
import { User } from '../../../core/models/user';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { fakeAuthService, testMember, testProject, testUser } from '../../../testing/test-data';
import { ProjectService } from '../project.service';
import { ProjectShell } from './project-shell';

describe('ProjectShell', () => {
  let fixture: ComponentFixture<ProjectShell>;
  let loader: HarnessLoader;
  let projectService: Record<'get' | 'setStatus' | 'delete', ReturnType<typeof vi.fn>>;
  let confirm: { confirm: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  const withTeam = () => testProject({ members: [testMember()] });

  async function render(project: Project = withTeam(), user: User = testUser()) {
    projectService = { get: vi.fn(() => of(project)), setStatus: vi.fn(), delete: vi.fn() };
    confirm = { confirm: vi.fn(() => of(true)) };
    toast = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      imports: [ProjectShell],
      providers: [
        provideRouter([]),
        { provide: ProjectService, useValue: projectService },
        { provide: AuthService, useValue: fakeAuthService(user) },
        { provide: ConfirmService, useValue: confirm },
        { provide: ToastService, useValue: toast },
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
      ],
    });
    fixture = TestBed.createComponent(ProjectShell);
    fixture.componentRef.setInput('id', 'p1');
    loader = TestbedHarnessEnvironment.loader(fixture);
    await fixture.whenStable();
  }

  const element = () => fixture.nativeElement as HTMLElement;
  const text = () => element().textContent ?? '';
  const buttonWithText = (label: string) =>
    [...element().querySelectorAll('button, a')].find((b) => b.textContent?.includes(label));
  const moreMenu = () =>
    loader.getHarness(MatMenuHarness.with({ selector: '[aria-label="More actions"]' }));

  it('shows the project name, its status and the tabs', async () => {
    await render();

    expect(projectService.get).toHaveBeenCalledWith('p1');
    expect(element().querySelector('h1')?.textContent).toBe('E-commerce platform');
    expect(element().querySelector('.status')?.textContent?.trim()).toBe('Planning');
    expect(
      [...element().querySelectorAll('[mat-tab-link]')].map((tab) => tab.textContent?.trim()),
    ).toEqual(['Overview', 'Sprints', 'Tasks', 'Board', 'Activity', 'Dashboard']);
  });

  it('gives the project manager the edit, status and deletion actions', async () => {
    await render();

    expect(element().querySelector('a[href="/projects/p1/edit"]')).not.toBeNull();
    expect(buttonWithText('Change status')).toBeDefined();
    expect(element().querySelector('[aria-label="More actions"]')).not.toBeNull();
  });

  it('has no action for an administrator (read-only)', async () => {
    await render(withTeam(), testUser({ id: 'a1', role: 'ADMIN' }));

    expect(element().querySelector('a[href="/projects/p1/edit"]')).toBeNull();
    expect(buttonWithText('Change status')).toBeUndefined();
  });

  it('changes the status; archiving asks for confirmation and shows the read-only banner', async () => {
    await render();
    projectService.setStatus.mockReturnValueOnce(of({ ...withTeam(), status: 'ACTIVE' }));
    const statusMenu = () =>
      loader.getHarness(MatMenuHarness.with({ triggerText: /Change status/ }));

    await (await statusMenu()).clickItem({ text: 'Active' });
    await fixture.whenStable();

    expect(confirm.confirm).not.toHaveBeenCalled();
    expect(projectService.setStatus).toHaveBeenCalledWith('p1', 'ACTIVE');
    expect(element().querySelector('.status')?.textContent?.trim()).toBe('Active');
    expect(toast.success).toHaveBeenCalledWith('Project status changed to Active.');

    projectService.setStatus.mockReturnValueOnce(of({ ...withTeam(), status: 'ARCHIVED' }));
    await (await statusMenu()).clickItem({ text: 'Archived' });
    await fixture.whenStable();

    expect(confirm.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Archive this project?' }),
    );
    expect(text()).toContain('This project is archived: it is read-only.');
    expect(element().querySelector('a[href="/projects/p1/edit"]')).toBeNull();
    expect(buttonWithText('Change status')).toBeDefined();
  });

  it('deletes the project after confirmation and goes back to the list', async () => {
    await render();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    projectService.delete.mockReturnValue(of(undefined));

    await (await moreMenu()).clickItem({ text: /Delete/ });
    await fixture.whenStable();

    expect(confirm.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Delete this project?', destructive: true }),
    );
    expect(projectService.delete).toHaveBeenCalledWith('p1');
    expect(toast.success).toHaveBeenCalledWith('The project has been deleted.');
    expect(navigate).toHaveBeenCalledWith('/projects');
  });

  it('reports a refused deletion (project with sprints or tasks)', async () => {
    await render();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    const message = 'The project still has sprints or tasks: archive it instead of deleting it';
    projectService.delete.mockReturnValue(throwError(() => new ApiError(409, 'CONFLICT', message)));

    await (await moreMenu()).clickItem({ text: /Delete/ });
    await fixture.whenStable();

    expect(toast.error).toHaveBeenCalledWith(message);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('reloads when the route parameter changes; "Project not found" has no retry', async () => {
    await render();
    projectService.get.mockReturnValue(
      throwError(() => new ApiError(404, 'NOT_FOUND', 'Project not found')),
    );

    fixture.componentRef.setInput('id', 'unknown');
    await fixture.whenStable();

    expect(projectService.get).toHaveBeenLastCalledWith('unknown');
    expect(text()).toContain('Project not found');
    expect(buttonWithText('Try again')).toBeUndefined();
  });
});
