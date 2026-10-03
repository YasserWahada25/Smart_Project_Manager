import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  EMPTY,
  Observable,
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  finalize,
  merge,
  of,
  switchMap,
  tap,
} from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { actionErrorMessage } from '../../../core/http/action-error';
import { ROLES, ROLE_LABELS, Role, User } from '../../../core/models/user';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { PagedList } from '../../../shared/data/paged-list';
import { UserAdminService, UserQuery } from '../user-admin.service';

type StatusFilter = '' | 'active' | 'inactive';

const fullName = (user: User) => `${user.firstName} ${user.lastName}`;

/**
 * Administration of the accounts (ADMIN): search, filters, pagination, role change and
 * activation. An administrator cannot change their own account (backend rule, mirrored here).
 */
@Component({
  selector: 'app-user-list',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatDividerModule,
    MatTooltipModule,
    ErrorState,
  ],
  templateUrl: './user-list.html',
  styleUrl: './user-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserList {
  private readonly service = inject(UserAdminService);
  private readonly auth = inject(AuthService);
  private readonly confirmService = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly columns = ['name', 'email', 'role', 'status', 'createdAt', 'actions'];
  protected readonly roles = ROLES;
  protected readonly roleLabels = ROLE_LABELS;
  protected readonly pageSizeOptions = [10, 20, 50];

  protected readonly filters = inject(NonNullableFormBuilder).group({
    search: [''],
    role: ['' as Role | ''],
    status: ['' as StatusFilter],
  });
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(10);
  private readonly list = new PagedList<UserQuery, User>(
    (query) => this.service.list(query),
    this.destroyRef,
  );
  protected readonly users = this.list.items;
  protected readonly total = this.list.total;
  protected readonly loading = this.list.loading;
  protected readonly errorMessage = this.list.errorMessage;
  /** User whose role/status change is in progress (their action menu is disabled meanwhile). */
  protected readonly busyId = signal<string | null>(null);

  constructor() {
    const { search, role, status } = this.filters.controls;
    merge(
      search.valueChanges.pipe(debounceTime(300), distinctUntilChanged()),
      role.valueChanges,
      status.valueChanges,
    )
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.pageIndex.set(0);
        this.load();
      });

    this.load();
  }

  protected load(): void {
    const { search, role, status } = this.filters.getRawValue();
    this.list.load({
      page: this.pageIndex() + 1,
      limit: this.pageSize(),
      role: role || undefined,
      isActive: status === '' ? undefined : status === 'active',
      search,
    });
  }

  protected changePage({ pageIndex, pageSize }: PageEvent): void {
    this.pageIndex.set(pageIndex);
    this.pageSize.set(pageSize);
    this.load();
  }

  protected roleLabel(role: Role): string {
    return ROLE_LABELS[role];
  }

  protected isSelf(user: User): boolean {
    return user.id === this.auth.currentUser()?.id;
  }

  protected otherRoles(user: User): Role[] {
    return this.roles.filter((role) => role !== user.role);
  }

  protected changeRole(user: User, role: Role): void {
    const name = fullName(user);
    const adminNote = role === 'ADMIN' ? ' Administrators can manage every account.' : '';
    this.confirmService
      .confirm({
        title: 'Change the role?',
        message:
          `The role of ${name} will change from ${ROLE_LABELS[user.role]} to ${ROLE_LABELS[role]}. ` +
          `It applies immediately, even to their current session.${adminNote}`,
        confirmLabel: 'Change role',
      })
      .pipe(
        filter(Boolean),
        switchMap(() => this.apply(user, this.service.setRole(user.id, role))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((updated) =>
        this.toast.success(`Role of ${name} changed to ${ROLE_LABELS[updated.role]}.`),
      );
  }

  protected setActive(user: User, isActive: boolean): void {
    const name = fullName(user);
    const confirmed: Observable<boolean> = isActive
      ? of(true)
      : this.confirmService.confirm({
          title: 'Deactivate this account?',
          message:
            `${name} will be signed out immediately and will no longer be able to sign in. ` +
            'Their projects, tasks and comments are kept. You can reactivate the account later.',
          confirmLabel: 'Deactivate',
          destructive: true,
        });

    confirmed
      .pipe(
        filter(Boolean),
        switchMap(() => this.apply(user, this.service.setActive(user.id, isActive))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() =>
        this.toast.success(
          `The account of ${name} has been ${isActive ? 'activated' : 'deactivated'}.`,
        ),
      );
  }

  /** Runs a change on one user and replaces their row with the updated user. */
  private apply(user: User, request: Observable<User>): Observable<User> {
    this.busyId.set(user.id);
    return request.pipe(
      tap((updated) => this.list.replace(updated)),
      catchError((error: unknown) => {
        const message = actionErrorMessage(error);
        if (message) this.toast.error(message);
        return EMPTY;
      }),
      finalize(() => this.busyId.set(null)),
    );
  }
}
