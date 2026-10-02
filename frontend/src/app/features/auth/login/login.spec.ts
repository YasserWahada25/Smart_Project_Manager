import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/models/api-error';
import { User } from '../../../core/models/user';
import { FakeAuthService, fakeAuthService, testUser } from '../../../testing/test-data';
import { Login } from './login';

describe('Login', () => {
  let fixture: ComponentFixture<Login>;
  let auth: FakeAuthService;
  let navigate: ReturnType<typeof vi.spyOn>;

  async function render(loginResult: Observable<User>, returnUrl?: string) {
    auth = fakeAuthService(null);
    auth.login.mockReturnValue(loginResult);
    TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(Login);
    if (returnUrl) fixture.componentRef.setInput('returnUrl', returnUrl);
    await fixture.whenStable();
  }

  const element = () => fixture.nativeElement as HTMLElement;
  const text = () => element().textContent ?? '';

  function type(name: string, value: string) {
    const input = element().querySelector<HTMLInputElement>(`input[formControlName="${name}"]`)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  async function submit() {
    element().querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  it('shows validation messages and does not call the API when the form is invalid', async () => {
    await render(of(testUser()));

    type('email', 'not-an-email');
    await submit();

    expect(text()).toContain('Enter a valid email address');
    expect(text()).toContain('Password is required');
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('logs in and opens the requested page', async () => {
    await render(of(testUser()), '/projects/42');

    type('email', 'sara@example.com');
    type('password', 'Secret123');
    await submit();

    expect(auth.login).toHaveBeenCalledWith({ email: 'sara@example.com', password: 'Secret123' });
    expect(navigate).toHaveBeenCalledWith('/projects/42');
  });

  it('ignores an external return URL', async () => {
    await render(of(testUser()), '//evil.example.com');

    type('email', 'sara@example.com');
    type('password', 'Secret123');
    await submit();

    expect(navigate).toHaveBeenCalledWith('/');
  });

  it.each([
    [401, 'Invalid email or password.'],
    [403, 'This account has been deactivated. Contact an administrator.'],
  ])('shows an explicit message for a %s', async (status, message) => {
    await render(throwError(() => new ApiError(status, 'ERR', 'backend message')));

    type('email', 'sara@example.com');
    type('password', 'Wrong1234');
    await submit();

    expect(element().querySelector('[role="alert"]')?.textContent).toContain(message);
    expect(navigate).not.toHaveBeenCalled();
    expect(element().querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(
      false,
    );
  });

  it('toggles the password visibility', async () => {
    await render(of(testUser()));
    const password = () =>
      element().querySelector<HTMLInputElement>('input[formControlName="password"]')!;

    expect(password().type).toBe('password');
    element().querySelector<HTMLButtonElement>('button[aria-label="Show password"]')!.click();
    await fixture.whenStable();

    expect(password().type).toBe('text');
  });
});
