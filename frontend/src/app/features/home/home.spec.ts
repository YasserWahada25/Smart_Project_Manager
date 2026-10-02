import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';

import { ApiError } from '../../core/models/api-error';
import { SystemStatus } from '../../core/models/system-status';
import { AuthService } from '../../core/auth/auth.service';
import { HealthService } from '../../core/services/health.service';
import { fakeAuthService, testUser } from '../../testing/test-data';
import { Home } from './home';

describe('Home', () => {
  let check: ReturnType<typeof vi.fn>;

  async function render(...results: Observable<SystemStatus>[]) {
    check = vi.fn();
    results.forEach((result) => check.mockReturnValueOnce(result));
    TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        { provide: HealthService, useValue: { check } },
        { provide: AuthService, useValue: fakeAuthService(testUser({ role: 'DEVELOPER' })) },
      ],
    });
    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();
    return fixture;
  }

  const text = (fixture: { nativeElement: HTMLElement }) => fixture.nativeElement.textContent ?? '';
  const status = (database: 'up' | 'down'): SystemStatus => ({
    backend: 'up',
    database,
    checkedAt: new Date(),
  });

  it('greets the signed-in user with their role', async () => {
    const fixture = await render(of(status('up')));

    expect(text(fixture)).toContain('Welcome, Sara');
    expect(text(fixture)).toContain('Signed in as Developer · sara@example.com');
  });

  it('shows a loading state while the services are being checked', async () => {
    const fixture = await render(new Subject<SystemStatus>());

    expect(text(fixture)).toContain('Checking the services…');
  });

  it('lists frontend, backend and database as operational', async () => {
    const fixture = await render(of(status('up')));

    const rows = fixture.nativeElement.querySelectorAll('.row');
    expect(rows).toHaveLength(3);
    expect(text(fixture)).toContain('Backend API');
    expect(text(fixture).match(/Operational/g)).toHaveLength(3);
    expect(fixture.nativeElement.querySelectorAll('.row.down')).toHaveLength(0);
  });

  it('highlights a database outage', async () => {
    const fixture = await render(of(status('down')));

    const down = fixture.nativeElement.querySelectorAll('.row.down');
    expect(down).toHaveLength(1);
    expect(down[0].textContent).toContain('Database');
    expect(down[0].textContent).toContain('Unavailable');
  });

  it('shows an error when the backend is unreachable and retries on demand', async () => {
    const unreachable = new ApiError(502, 'UNKNOWN_ERROR', 'The server is unavailable.');
    const fixture = await render(
      throwError(() => unreachable),
      of(status('up')),
    );

    expect(text(fixture)).toContain('The backend API is unreachable. The server is unavailable.');

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[role="alert"] button')
      ?.click();
    await fixture.whenStable();

    expect(check).toHaveBeenCalledTimes(2);
    expect(text(fixture)).toContain('Operational');
  });
});
