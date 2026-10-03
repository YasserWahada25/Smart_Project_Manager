import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';

import { ApiError } from '../../../core/models/api-error';
import { User } from '../../../core/models/user';
import { ToastService } from '../../../core/services/toast.service';
import { testUser } from '../../../testing/test-data';
import { ProfileService } from '../profile.service';
import { PasswordForm } from './password-form';

describe('PasswordForm', () => {
  let fixture: ComponentFixture<PasswordForm>;
  let profile: { changePassword: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn> };

  async function render(result: Observable<User> = of(testUser())) {
    profile = { changePassword: vi.fn(() => result) };
    toast = { success: vi.fn() };
    TestBed.configureTestingModule({
      imports: [PasswordForm],
      providers: [
        { provide: ProfileService, useValue: profile },
        { provide: ToastService, useValue: toast },
      ],
    });
    fixture = TestBed.createComponent(PasswordForm);
    await fixture.whenStable();
  }

  const element = () => fixture.nativeElement as HTMLElement;
  const text = () => element().textContent ?? '';
  const field = (name: string) =>
    element().querySelector<HTMLInputElement>(`input[formControlName="${name}"]`)!;

  function type(name: string, value: string) {
    field(name).value = value;
    field(name).dispatchEvent(new Event('input'));
  }

  function fill(current: string, next: string, confirm = next) {
    type('currentPassword', current);
    type('newPassword', next);
    type('confirmPassword', confirm);
  }

  async function submit() {
    element().querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  it('requires the three fields', async () => {
    await render();

    await submit();

    expect(text()).toContain('Enter your current password');
    expect(text()).toContain('Enter a new password');
    expect(text()).toContain('Confirm the new password');
    expect(profile.changePassword).not.toHaveBeenCalled();
  });

  it('applies the password policy and checks the confirmation', async () => {
    await render();

    fill('Secret123', 'newpassword', 'other');
    await submit();

    expect(text()).toContain('Password must contain at least one digit');
    expect(text()).toContain('Passwords do not match');
    expect(profile.changePassword).not.toHaveBeenCalled();
  });

  it('changes the password, confirms and clears the form', async () => {
    await render();

    fill('Secret123', 'NewSecret456');
    await submit();

    expect(profile.changePassword).toHaveBeenCalledWith({
      currentPassword: 'Secret123',
      newPassword: 'NewSecret456',
    });
    expect(toast.success).toHaveBeenCalledWith(
      'Your password has been changed. Your other devices have been signed out.',
    );
    expect(field('currentPassword').value).toBe('');
    expect(field('newPassword').value).toBe('');
    expect(text()).not.toContain('Enter your current password');
  });

  it('shows "current password is incorrect" on its field (400, the session is kept)', async () => {
    await render(
      throwError(
        () =>
          new ApiError(400, 'BAD_REQUEST', 'Validation failed', [
            { field: 'currentPassword', message: 'Current password is incorrect' },
          ]),
      ),
    );

    fill('Wrong1234', 'NewSecret456');
    await submit();

    expect(text()).toContain('Current password is incorrect');
    expect(element().querySelector('[role="alert"]')).toBeNull();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('shows or hides the passwords', async () => {
    await render();
    const toggle = element().querySelector<HTMLButtonElement>('[aria-label="Show passwords"]')!;

    toggle.click();
    await fixture.whenStable();

    expect(field('currentPassword').type).toBe('text');
    expect(field('newPassword').type).toBe('text');
    expect(toggle.getAttribute('aria-label')).toBe('Hide passwords');
  });
});
