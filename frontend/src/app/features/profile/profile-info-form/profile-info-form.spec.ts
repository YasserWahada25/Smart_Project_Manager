import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { ApiError } from '../../../core/models/api-error';
import { User } from '../../../core/models/user';
import { ToastService } from '../../../core/services/toast.service';
import { testUser } from '../../../testing/test-data';
import { ProfileService } from '../profile.service';
import { ProfileInfoForm } from './profile-info-form';

describe('ProfileInfoForm', () => {
  let fixture: ComponentFixture<ProfileInfoForm>;
  let profile: { update: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn> };

  async function render(user: User = testUser({ jobTitle: 'Lead', bio: 'Hello' })) {
    profile = { update: vi.fn() };
    toast = { success: vi.fn() };
    TestBed.configureTestingModule({
      imports: [ProfileInfoForm],
      providers: [
        { provide: ProfileService, useValue: profile },
        { provide: ToastService, useValue: toast },
      ],
    });
    fixture = TestBed.createComponent(ProfileInfoForm);
    fixture.componentRef.setInput('user', user);
    await fixture.whenStable();
  }

  const element = () => fixture.nativeElement as HTMLElement;
  const text = () => element().textContent ?? '';
  const field = (name: string) =>
    element().querySelector<HTMLInputElement>(`[formControlName="${name}"]`)!;
  const button = (label: string) =>
    [...element().querySelectorAll('button')].find((b) => b.textContent?.trim() === label)!;

  async function type(name: string, value: string) {
    field(name).value = value;
    field(name).dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  async function submit() {
    element().querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  it('shows the current values; Save is enabled only after a change', async () => {
    await render();

    expect(field('firstName').value).toBe('Sara');
    expect(field('jobTitle').value).toBe('Lead');
    expect(field('bio').value).toBe('Hello');
    expect(button('Save').disabled).toBe(true);

    await type('jobTitle', 'Tech lead');
    expect(button('Save').disabled).toBe(false);
  });

  it('validates the fields before sending', async () => {
    await render();

    await type('firstName', '   ');
    await type('bio', 'x'.repeat(501));
    await submit();

    expect(text()).toContain('First name is required');
    expect(text()).toContain('At most 500 characters');
    expect(profile.update).not.toHaveBeenCalled();
  });

  it('saves trimmed values, confirms and emits the updated user', async () => {
    await render();
    const updated = testUser({ jobTitle: 'Tech lead', bio: 'Hello' });
    profile.update.mockReturnValue(of(updated));
    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);

    await type('jobTitle', '  Tech lead  ');
    await submit();

    expect(profile.update).toHaveBeenCalledWith({
      firstName: 'Sara',
      lastName: 'Manager',
      jobTitle: 'Tech lead',
      bio: 'Hello',
    });
    expect(toast.success).toHaveBeenCalledWith('Your profile has been updated.');
    expect(saved).toHaveBeenCalledWith(updated);
    expect(button('Save').disabled).toBe(true);
  });

  it('Cancel restores the saved values', async () => {
    await render();

    await type('jobTitle', 'Something else');
    button('Cancel').click();
    await fixture.whenStable();

    expect(field('jobTitle').value).toBe('Lead');
    expect(button('Save').disabled).toBe(true);
  });

  it('shows backend validation messages on the fields, other errors above the form', async () => {
    await render();
    profile.update.mockReturnValueOnce(
      throwError(
        () =>
          new ApiError(400, 'BAD_REQUEST', 'Validation failed', [
            { field: 'lastName', message: 'Last name must be at most 50 characters' },
          ]),
      ),
    );

    await type('lastName', 'Changed');
    await submit();
    expect(text()).toContain('Last name must be at most 50 characters');
    expect(element().querySelector('[role="alert"]')).toBeNull();

    profile.update.mockReturnValueOnce(
      throwError(() => new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server.')),
    );
    await type('lastName', 'Changed again');
    await submit();
    expect(element().querySelector('[role="alert"]')?.textContent).toContain(
      'Cannot reach the server.',
    );
  });
});
