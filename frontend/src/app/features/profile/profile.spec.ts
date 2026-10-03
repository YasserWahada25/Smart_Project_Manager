import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { ApiError } from '../../core/models/api-error';
import { User } from '../../core/models/user';
import { ToastService } from '../../core/services/toast.service';
import { testUser } from '../../testing/test-data';
import { Profile } from './profile';
import { ProfileService } from './profile.service';

describe('Profile page', () => {
  let fixture: ComponentFixture<Profile>;
  let profile: {
    load: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateSkills: ReturnType<typeof vi.fn>;
    changePassword: ReturnType<typeof vi.fn>;
  };

  async function render(load: ReturnType<typeof vi.fn>) {
    profile = { load, update: vi.fn(), updateSkills: vi.fn(), changePassword: vi.fn() };
    TestBed.configureTestingModule({
      imports: [Profile],
      providers: [
        { provide: ProfileService, useValue: profile },
        { provide: ToastService, useValue: { success: vi.fn() } },
      ],
    });
    fixture = TestBed.createComponent(Profile);
    await fixture.whenStable();
  }

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('shows a loader, then the account details and the three forms', async () => {
    const response = new Subject<User>();
    await render(vi.fn(() => response));
    expect(text()).toContain('Loading your profile');

    response.next(
      testUser({
        role: 'DEVELOPER',
        email: 'youssef@example.com',
        // Midday UTC: the same calendar day in every time zone the tests may run in.
        createdAt: '2026-10-01T12:00:00.000Z',
      }),
    );
    await fixture.whenStable();

    expect(text()).toContain('youssef@example.com');
    expect(text()).toContain('Developer');
    expect(text()).toContain('October 1, 2026');
    expect(text()).toContain('Your email cannot be changed');
    expect(text()).toContain('Personal information');
    expect(text()).toContain('Skills');
    expect(text()).toContain('Change password');
  });

  it('shows the error with a retry button', async () => {
    await render(
      vi
        .fn()
        .mockReturnValueOnce(
          throwError(() => new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server.')),
        )
        .mockReturnValueOnce(of(testUser())),
    );
    expect(text()).toContain('Cannot reach the server.');

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('app-error-state button')!
      .click();
    await fixture.whenStable();

    expect(profile.load).toHaveBeenCalledTimes(2);
    expect(text()).toContain('sara@example.com');
  });
});
