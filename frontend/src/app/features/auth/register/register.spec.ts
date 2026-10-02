import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/models/api-error';
import { User } from '../../../core/models/user';
import { ToastService } from '../../../core/services/toast.service';
import { FakeAuthService, fakeAuthService, testUser } from '../../../testing/test-data';
import { Register } from './register';

describe('Register', () => {
  let fixture: ComponentFixture<Register>;
  let auth: FakeAuthService;
  let toastSuccess: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.spyOn>;

  async function render(result: Observable<User>) {
    auth = fakeAuthService(null);
    auth.register.mockReturnValue(result);
    toastSuccess = vi.fn();
    TestBed.configureTestingModule({
      imports: [Register],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: ToastService, useValue: { success: toastSuccess } },
      ],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(Register);
    await fixture.whenStable();
  }

  const element = () => fixture.nativeElement as HTMLElement;
  const text = () => element().textContent ?? '';

  function type(name: string, value: string) {
    const input = element().querySelector<HTMLInputElement>(`input[formControlName="${name}"]`)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function fillValidForm(password = 'Secret123') {
    type('firstName', 'Youssef');
    type('lastName', 'Alami');
    type('email', 'youssef@example.com');
    type('password', password);
    type('confirmPassword', password);
  }

  async function submit() {
    element().querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  it('applies the password policy and checks the confirmation', async () => {
    await render(of(testUser()));

    fillValidForm('password');
    type('confirmPassword', 'different1');
    await submit();

    expect(text()).toContain('Password must contain at least one digit');
    expect(text()).toContain('Passwords do not match');
    expect(auth.register).not.toHaveBeenCalled();
  });

  it('re-checks the confirmation when the password changes', async () => {
    await render(of(testUser()));

    fillValidForm();
    type('password', 'Secret1234');
    await submit();

    expect(text()).toContain('Passwords do not match');
  });

  it('creates a developer account by default, then opens the application', async () => {
    await render(of(testUser({ firstName: 'Youssef', role: 'DEVELOPER' })));

    fillValidForm();
    await submit();

    expect(auth.register).toHaveBeenCalledWith({
      firstName: 'Youssef',
      lastName: 'Alami',
      email: 'youssef@example.com',
      password: 'Secret123',
      role: 'DEVELOPER',
    });
    expect(toastSuccess).toHaveBeenCalledWith('Welcome, Youssef! Your account has been created.');
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('can create a project manager account', async () => {
    await render(of(testUser()));

    fillValidForm();
    element()
      .querySelector<HTMLInputElement>('input[type="radio"][value="PROJECT_MANAGER"]')!
      .click();
    await submit();

    expect(auth.register).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'PROJECT_MANAGER' }),
    );
  });

  it('shows "already registered" on the email field for a 409', async () => {
    await render(throwError(() => new ApiError(409, 'CONFLICT', 'Email is already registered')));

    fillValidForm();
    await submit();

    expect(text()).toContain('This email is already registered');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('shows backend validation messages on the matching fields', async () => {
    await render(
      throwError(
        () =>
          new ApiError(400, 'BAD_REQUEST', 'Validation failed', [
            { field: 'firstName', message: 'First name must be at most 50 characters' },
          ]),
      ),
    );

    fillValidForm();
    await submit();

    expect(text()).toContain('First name must be at most 50 characters');
    expect(element().querySelector('[role="alert"]')).toBeNull();
  });

  it('shows other errors above the form', async () => {
    await render(throwError(() => new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server.')));

    fillValidForm();
    await submit();

    expect(element().querySelector('[role="alert"]')?.textContent).toContain(
      'Cannot reach the server.',
    );
  });
});
