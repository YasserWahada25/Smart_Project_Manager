import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { User } from '../../core/models/user';
import { testUser } from '../../testing/test-data';
import { UserAdminService } from './user-admin.service';

describe('UserAdminService', () => {
  let httpTesting: HttpTestingController;
  let service: UserAdminService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    service = TestBed.inject(UserAdminService);
  });

  afterEach(() => httpTesting.verify());

  it('lists users with the filters that are set', () => {
    service
      .list({ page: 2, limit: 10, role: 'DEVELOPER', isActive: false, search: '  alami ' })
      .subscribe();

    const request = httpTesting.expectOne((req) => req.url === '/api/v1/users');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.toString()).toBe(
      'page=2&limit=10&role=DEVELOPER&isActive=false&search=alami',
    );
    request.flush({ data: [], pagination: { page: 2, limit: 10, total: 0, totalPages: 0 } });
  });

  it('leaves out empty filters', () => {
    service.list({ page: 1, limit: 20, search: '   ' }).subscribe();

    const request = httpTesting.expectOne((req) => req.url === '/api/v1/users');
    expect(request.request.params.toString()).toBe('page=1&limit=20');
    request.flush({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
  });

  it('activates or deactivates an account', () => {
    let result: User | undefined;
    service.setActive('u2', false).subscribe((user) => (result = user));

    const request = httpTesting.expectOne('/api/v1/users/u2/status');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ isActive: false });
    request.flush({ user: testUser({ id: 'u2', isActive: false }) });

    expect(result?.isActive).toBe(false);
  });

  it('changes the role of an account', () => {
    let result: User | undefined;
    service.setRole('u2', 'PROJECT_MANAGER').subscribe((user) => (result = user));

    const request = httpTesting.expectOne('/api/v1/users/u2/role');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ role: 'PROJECT_MANAGER' });
    request.flush({ user: testUser({ id: 'u2', role: 'PROJECT_MANAGER' }) });

    expect(result?.role).toBe('PROJECT_MANAGER');
  });
});
