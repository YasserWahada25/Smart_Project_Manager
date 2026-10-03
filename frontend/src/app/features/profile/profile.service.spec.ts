import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AuthService } from '../../core/auth/auth.service';
import { User } from '../../core/models/user';
import { FakeAuthService, fakeAuthService, testToken, testUser } from '../../testing/test-data';
import { ProfileService } from './profile.service';

describe('ProfileService', () => {
  let httpTesting: HttpTestingController;
  let auth: FakeAuthService;
  let service: ProfileService;

  beforeEach(() => {
    auth = fakeAuthService(testUser());
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    service = TestBed.inject(ProfileService);
  });

  afterEach(() => httpTesting.verify());

  it('loads the profile and refreshes the user kept in the session', () => {
    let result: User | undefined;
    service.load().subscribe((user) => (result = user));

    const request = httpTesting.expectOne('/api/v1/profile');
    expect(request.request.method).toBe('GET');
    request.flush({ user: testUser({ jobTitle: 'Tech lead' }) });

    expect(result?.jobTitle).toBe('Tech lead');
    expect(auth.updateCurrentUser).toHaveBeenCalledWith(testUser({ jobTitle: 'Tech lead' }));
  });

  it('updates the personal information', () => {
    const changes = { firstName: 'Sara', lastName: 'Manager', jobTitle: 'PM', bio: '' };
    service.update(changes).subscribe();

    const request = httpTesting.expectOne('/api/v1/profile');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual(changes);
    request.flush({ user: testUser({ jobTitle: 'PM' }) });

    expect(auth.currentUser()?.jobTitle).toBe('PM');
  });

  it('replaces the whole skill list', () => {
    const skills = [{ name: 'Angular', level: 'ADVANCED' as const, yearsOfExperience: 3 }];
    service.updateSkills(skills).subscribe();

    const request = httpTesting.expectOne('/api/v1/profile/skills');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ skills });
    request.flush({ user: testUser({ skills }) });

    expect(auth.currentUser()?.skills).toEqual(skills);
  });

  it('changes the password and switches the session to the new token', () => {
    let result: User | undefined;
    service
      .changePassword({ currentPassword: 'Secret123', newPassword: 'NewSecret456' })
      .subscribe((user) => (result = user));

    const request = httpTesting.expectOne('/api/v1/profile/password');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({
      currentPassword: 'Secret123',
      newPassword: 'NewSecret456',
    });
    const response = { token: testToken(), tokenType: 'Bearer', expiresIn: '1d', user: testUser() };
    request.flush(response);

    expect(auth.replaceSession).toHaveBeenCalledWith(response);
    expect(result).toEqual(testUser());
  });

  it('leaves the session untouched when the backend refuses the change', () => {
    service.update({ firstName: '', lastName: 'M', jobTitle: '', bio: '' }).subscribe({
      error: () => undefined,
    });

    httpTesting
      .expectOne('/api/v1/profile')
      .flush(
        { error: { status: 400, code: 'BAD_REQUEST', message: 'Validation failed' } },
        { status: 400, statusText: 'Bad Request' },
      );

    expect(auth.updateCurrentUser).not.toHaveBeenCalled();
  });
});
