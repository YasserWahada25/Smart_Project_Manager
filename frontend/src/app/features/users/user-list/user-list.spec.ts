import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatMenuHarness } from '@angular/material/menu/testing';
import { MatPaginatorHarness } from '@angular/material/paginator/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { of, throwError } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/models/api-error';
import { User } from '../../../core/models/user';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { fakeAuthService, testUser } from '../../../testing/test-data';
import { UserAdminService } from '../user-admin.service';
import { UserList } from './user-list';

describe('UserList', () => {
  let fixture: ComponentFixture<UserList>;
  let loader: HarnessLoader;
  let service: {
    list: ReturnType<typeof vi.fn>;
    setActive: ReturnType<typeof vi.fn>;
    setRole: ReturnType<typeof vi.fn>;
  };
  let confirm: { confirm: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  const admin = testUser({ id: 'a1', firstName: 'Ada', lastName: 'Admin', role: 'ADMIN' });
  const developer = testUser({
    id: 'u2',
    firstName: 'Youssef',
    lastName: 'Alami',
    email: 'youssef@example.com',
    role: 'DEVELOPER',
  });
  const page = (users: User[], total = users.length) => ({
    data: users,
    pagination: { page: 1, limit: 10, total, totalPages: Math.ceil(total / 10) },
  });

  async function render(list = vi.fn(() => of(page([admin, developer])))) {
    service = { list, setActive: vi.fn(), setRole: vi.fn() };
    confirm = { confirm: vi.fn(() => of(true)) };
    toast = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      imports: [UserList],
      providers: [
        { provide: UserAdminService, useValue: service },
        { provide: ConfirmService, useValue: confirm },
        { provide: ToastService, useValue: toast },
        { provide: AuthService, useValue: fakeAuthService(admin) },
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
      ],
    });
    fixture = TestBed.createComponent(UserList);
    loader = TestbedHarnessEnvironment.loader(fixture);
    await fixture.whenStable();
  }

  const element = () => fixture.nativeElement as HTMLElement;
  const rows = () => [...element().querySelectorAll('tr[mat-row]')].map((row) => row.textContent);
  const actionsOf = (name: string) =>
    loader.getHarness(MatMenuHarness.with({ selector: `[aria-label="Actions for ${name}"]` }));
  const lastQuery = () => service.list.mock.lastCall?.[0];

  it('loads the first page and shows the users', async () => {
    await render();

    expect(service.list).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      role: undefined,
      isActive: undefined,
      search: '',
    });
    expect(rows()).toHaveLength(2);
    expect(rows()[1]).toContain('Youssef Alami');
    expect(rows()[1]).toContain('youssef@example.com');
    expect(rows()[1]).toContain('Developer');
    expect(rows()[1]).toContain('Active');
  });

  it('marks the own account and offers no action on it', async () => {
    await render();

    expect(rows()[0]).toContain('You');
    expect(element().querySelector('[aria-label="Actions for Ada Admin"]')).toBeNull();
    expect(
      element().querySelector('[aria-label="You cannot change your own account"]'),
    ).not.toBeNull();
  });

  it('filters by search (debounced), role and status', async () => {
    await render();

    const search = element().querySelector<HTMLInputElement>('input[formControlName="search"]')!;
    search.value = 'alami';
    search.dispatchEvent(new Event('input'));
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(lastQuery()).toEqual(expect.objectContaining({ search: 'alami', page: 1 }));

    const role = await loader.getHarness(
      MatSelectHarness.with({ selector: '[formControlName="role"]' }),
    );
    await role.open();
    await role.clickOptions({ text: 'Developer' });
    expect(lastQuery()).toEqual(expect.objectContaining({ role: 'DEVELOPER' }));

    const status = await loader.getHarness(
      MatSelectHarness.with({ selector: '[formControlName="status"]' }),
    );
    await status.open();
    await status.clickOptions({ text: 'Deactivated' });
    expect(lastQuery()).toEqual(
      expect.objectContaining({ role: 'DEVELOPER', isActive: false, search: 'alami' }),
    );
  });

  it('goes to the next page', async () => {
    await render(vi.fn(() => of(page([admin, developer], 25))));

    await (await loader.getHarness(MatPaginatorHarness)).goToNextPage();

    expect(lastQuery()).toEqual(expect.objectContaining({ page: 2, limit: 10 }));
  });

  it('changes the role after confirmation and updates the row', async () => {
    await render();
    service.setRole.mockReturnValue(of({ ...developer, role: 'PROJECT_MANAGER' }));

    await (await actionsOf('Youssef Alami')).clickItem({ text: /Project manager/ });
    await fixture.whenStable();

    expect(confirm.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Change the role?',
        message: expect.stringContaining('from Developer to Project manager'),
      }),
    );
    expect(service.setRole).toHaveBeenCalledWith('u2', 'PROJECT_MANAGER');
    expect(rows()[1]).toContain('Project manager');
    expect(toast.success).toHaveBeenCalledWith('Role of Youssef Alami changed to Project manager.');
  });

  it('does nothing when the confirmation is cancelled', async () => {
    await render();
    confirm.confirm.mockReturnValue(of(false));

    await (await actionsOf('Youssef Alami')).clickItem({ text: /Deactivate/ });
    await fixture.whenStable();

    expect(confirm.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Deactivate this account?', destructive: true }),
    );
    expect(service.setActive).not.toHaveBeenCalled();
  });

  it('deactivates after confirmation, reactivates without confirmation', async () => {
    await render();
    service.setActive.mockReturnValueOnce(of({ ...developer, isActive: false }));

    await (await actionsOf('Youssef Alami')).clickItem({ text: /Deactivate/ });
    await fixture.whenStable();

    expect(service.setActive).toHaveBeenCalledWith('u2', false);
    expect(rows()[1]).toContain('Deactivated');
    expect(toast.success).toHaveBeenCalledWith(
      'The account of Youssef Alami has been deactivated.',
    );

    service.setActive.mockReturnValueOnce(of(developer));
    confirm.confirm.mockClear();
    await (await actionsOf('Youssef Alami')).clickItem({ text: /Activate/ });
    await fixture.whenStable();

    expect(confirm.confirm).not.toHaveBeenCalled();
    expect(service.setActive).toHaveBeenLastCalledWith('u2', true);
    expect(rows()[1]).toContain('Active');
  });

  it('shows the backend message when a change is refused', async () => {
    await render();
    service.setRole.mockReturnValue(
      throwError(() => new ApiError(404, 'NOT_FOUND', 'User not found')),
    );

    await (await actionsOf('Youssef Alami')).clickItem({ text: /Administrator/ });
    await fixture.whenStable();

    expect(toast.error).toHaveBeenCalledWith('User not found');
    expect(rows()[1]).toContain('Developer');
  });

  it('shows an error state with a retry button when the list cannot be loaded', async () => {
    await render(
      vi
        .fn()
        .mockReturnValueOnce(
          throwError(() => new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server.')),
        )
        .mockReturnValue(of(page([admin, developer]))),
    );
    expect(element().textContent).toContain('Cannot reach the server.');

    element().querySelector<HTMLButtonElement>('app-error-state button')!.click();
    await fixture.whenStable();

    expect(rows()).toHaveLength(2);
  });
});
