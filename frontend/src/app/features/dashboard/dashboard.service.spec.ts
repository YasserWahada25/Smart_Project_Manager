import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { describeDaysRemaining } from '../../core/models/dashboard';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  let httpTesting: HttpTestingController;
  let service: DashboardService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    service = TestBed.inject(DashboardService);
  });

  afterEach(() => httpTesting.verify());

  it('loads the global and the project dashboards', () => {
    service.get().subscribe();
    httpTesting.expectOne('/api/v1/dashboard').flush({});

    service.forProject('p1').subscribe();
    httpTesting.expectOne('/api/v1/projects/p1/dashboard').flush({});
  });

  it('searches with a trimmed query and a limit per type', () => {
    service.search('  payment ', 10).subscribe();

    const request = httpTesting.expectOne((req) => req.url === '/api/v1/search');
    expect(request.request.params.toString()).toBe('q=payment&limit=10');
    request.flush({});
  });
});

describe('describeDaysRemaining', () => {
  it.each([
    [5, '5 days left'],
    [1, '1 day left'],
    [0, 'Ends today'],
    [-1, '1 day late'],
    [-3, '3 days late'],
  ])('%i → %s', (days, expected) => {
    expect(describeDaysRemaining(days)).toBe(expected);
  });
});
