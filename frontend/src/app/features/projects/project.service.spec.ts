import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Project } from '../../core/models/project';
import { testMember, testProject } from '../../testing/test-data';
import { DeveloperService } from './developer.service';
import { ProjectService } from './project.service';

describe('ProjectService', () => {
  let httpTesting: HttpTestingController;
  let service: ProjectService;

  const input = {
    name: 'E-commerce platform',
    description: '',
    startDate: '2026-10-01',
    technologies: ['Angular'],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    service = TestBed.inject(ProjectService);
  });

  afterEach(() => httpTesting.verify());

  it('lists projects with the filters that are set', () => {
    service.list({ page: 2, limit: 12, status: 'ACTIVE', search: ' shop ' }).subscribe();
    const request = httpTesting.expectOne((req) => req.url === '/api/v1/projects');
    expect(request.request.params.toString()).toBe('page=2&limit=12&status=ACTIVE&search=shop');
    request.flush({ data: [], pagination: { page: 2, limit: 12, total: 0, totalPages: 0 } });

    service.list({ page: 1, limit: 12, search: '' }).subscribe();
    const unfiltered = httpTesting.expectOne((req) => req.url === '/api/v1/projects');
    expect(unfiltered.request.params.toString()).toBe('page=1&limit=12');
    unfiltered.flush({ data: [], pagination: { page: 1, limit: 12, total: 0, totalPages: 0 } });
  });

  it('gets a project', () => {
    let result: Project | undefined;
    service.get('p1').subscribe((project) => (result = project));

    httpTesting.expectOne('/api/v1/projects/p1').flush({ project: testProject() });

    expect(result?.name).toBe('E-commerce platform');
  });

  it('creates a project, without the deadline when it is empty', () => {
    service.create({ ...input, deadline: null }).subscribe();
    const withoutDeadline = httpTesting.expectOne('/api/v1/projects');
    expect(withoutDeadline.request.method).toBe('POST');
    expect(withoutDeadline.request.body).toEqual(input);
    withoutDeadline.flush({ project: testProject() });

    service.create({ ...input, deadline: '2027-01-31' }).subscribe();
    const withDeadline = httpTesting.expectOne('/api/v1/projects');
    expect(withDeadline.request.body).toEqual({ ...input, deadline: '2027-01-31' });
    withDeadline.flush({ project: testProject() });
  });

  it('updates a project (deadline null removes it) and changes its status', () => {
    service.update('p1', { ...input, deadline: null }).subscribe();
    const update = httpTesting.expectOne('/api/v1/projects/p1');
    expect(update.request.method).toBe('PATCH');
    expect(update.request.body).toEqual({ ...input, deadline: null });
    update.flush({ project: testProject() });

    service.setStatus('p1', 'ARCHIVED').subscribe();
    const status = httpTesting.expectOne('/api/v1/projects/p1');
    expect(status.request.body).toEqual({ status: 'ARCHIVED' });
    status.flush({ project: testProject({ status: 'ARCHIVED' }) });
  });

  it('deletes a project', () => {
    let done = false;
    service.delete('p1').subscribe(() => (done = true));

    const request = httpTesting.expectOne('/api/v1/projects/p1');
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(done).toBe(true);
  });

  it('adds and removes team members', () => {
    let result: Project | undefined;
    service.addMember('p1', 'd1').subscribe((project) => (result = project));
    const add = httpTesting.expectOne('/api/v1/projects/p1/members');
    expect(add.request.method).toBe('POST');
    expect(add.request.body).toEqual({ userId: 'd1' });
    add.flush({ project: testProject({ members: [testMember()] }) });
    expect(result?.members).toHaveLength(1);

    service.removeMember('p1', 'd1').subscribe((project) => (result = project));
    const remove = httpTesting.expectOne('/api/v1/projects/p1/members/d1');
    expect(remove.request.method).toBe('DELETE');
    remove.flush({ project: testProject() });
    expect(result?.members).toHaveLength(0);
  });
});

describe('DeveloperService', () => {
  it('searches the developer directory by name/email and by skill', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const httpTesting = TestBed.inject(HttpTestingController);

    TestBed.inject(DeveloperService)
      .search({ page: 1, limit: 8, search: ' ali ', skill: ' node.js ' })
      .subscribe();

    const request = httpTesting.expectOne((req) => req.url === '/api/v1/developers');
    expect(request.request.params.toString()).toBe('page=1&limit=8&search=ali&skill=node.js');
    request.flush({ data: [], pagination: { page: 1, limit: 8, total: 0, totalPages: 0 } });
    httpTesting.verify();
  });
});
