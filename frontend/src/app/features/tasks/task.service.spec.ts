import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Sprint } from '../../core/models/sprint';
import { testPage, testSprint, testTask } from '../../testing/test-data';
import { SprintService } from '../sprints/sprint.service';
import { TaskService } from './task.service';

describe('TaskService', () => {
  let httpTesting: HttpTestingController;
  let service: TaskService;

  const input = {
    title: 'Login page',
    description: '',
    type: 'FEATURE' as const,
    priority: 'HIGH' as const,
    complexity: 5,
    requiredSkills: ['Angular'],
    sprint: 's1',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    service = TestBed.inject(TaskService);
  });

  afterEach(() => httpTesting.verify());

  it('lists the tasks of a project with the filters that are set', () => {
    service
      .list('p1', {
        page: 2,
        limit: 20,
        status: 'BLOCKED',
        assignee: 'unassigned',
        sprint: 'backlog',
        search: ' login ',
        overdue: true,
      })
      .subscribe();

    const request = httpTesting.expectOne((req) => req.url === '/api/v1/projects/p1/tasks');
    expect(request.request.params.toString()).toBe(
      'page=2&limit=20&status=BLOCKED&assignee=unassigned&sprint=backlog&search=login&overdue=true',
    );
    request.flush(testPage([]));
  });

  it('lists my tasks', () => {
    service.assigned({ page: 1, limit: 20, status: 'TODO' }).subscribe();

    const request = httpTesting.expectOne((req) => req.url === '/api/v1/tasks/assigned');
    expect(request.request.params.toString()).toBe('page=1&limit=20&status=TODO');
    request.flush(testPage([]));
  });

  it('creates a task (empty deadline not sent) and updates it (deadline null removes it)', () => {
    service.create('p1', { ...input, deadline: null, assignee: 'd1' }).subscribe();
    const create = httpTesting.expectOne('/api/v1/projects/p1/tasks');
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({ ...input, assignee: 'd1' });
    create.flush({ task: testTask() });

    service.update('t1', { ...input, deadline: null }).subscribe();
    const update = httpTesting.expectOne('/api/v1/tasks/t1');
    expect(update.request.method).toBe('PATCH');
    expect(update.request.body).toEqual({ ...input, deadline: null });
    update.flush({ task: testTask() });
  });

  it('changes the status (with an optional blocking reason) and the assignee', () => {
    service.setStatus('t1', 'IN_PROGRESS').subscribe();
    const move = httpTesting.expectOne('/api/v1/tasks/t1/status');
    expect(move.request.body).toEqual({ status: 'IN_PROGRESS' });
    move.flush({ task: testTask({ status: 'IN_PROGRESS' }) });

    service.setStatus('t1', 'BLOCKED', 'Waiting for the API').subscribe();
    const block = httpTesting.expectOne('/api/v1/tasks/t1/status');
    expect(block.request.body).toEqual({ status: 'BLOCKED', blockedReason: 'Waiting for the API' });
    block.flush({ task: testTask({ status: 'BLOCKED' }) });

    service.setAssignee('t1', null).subscribe();
    const assign = httpTesting.expectOne('/api/v1/tasks/t1/assignee');
    expect(assign.request.body).toEqual({ assigneeId: null });
    assign.flush({ task: testTask({ assignee: null }) });
  });

  it('gets and deletes a task', () => {
    service.get('t1').subscribe();
    httpTesting.expectOne('/api/v1/tasks/t1').flush({ task: testTask() });

    service.delete('t1').subscribe();
    const remove = httpTesting.expectOne('/api/v1/tasks/t1');
    expect(remove.request.method).toBe('DELETE');
    remove.flush(null, { status: 204, statusText: 'No Content' });
  });
});

describe('SprintService', () => {
  let httpTesting: HttpTestingController;
  let service: SprintService;
  const input = { name: 'Sprint 1', objective: '', startDate: '2026-10-05', endDate: '2026-10-18' };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    service = TestBed.inject(SprintService);
  });

  afterEach(() => httpTesting.verify());

  it('loads all the sprints of a project in one request', () => {
    let result: Sprint[] | undefined;
    service.list('p1').subscribe((sprints) => (result = sprints));

    const request = httpTesting.expectOne((req) => req.url === '/api/v1/projects/p1/sprints');
    expect(request.request.params.toString()).toBe('page=1&limit=100');
    request.flush(testPage([testSprint()]));

    expect(result?.[0].name).toBe('Sprint 1');
  });

  it('creates, updates, changes the status of and deletes a sprint', () => {
    service.create('p1', input).subscribe();
    const create = httpTesting.expectOne('/api/v1/projects/p1/sprints');
    expect(create.request.body).toEqual(input);
    create.flush({ sprint: testSprint() });

    service.update('s1', input).subscribe();
    const update = httpTesting.expectOne('/api/v1/sprints/s1');
    expect(update.request.method).toBe('PATCH');
    update.flush({ sprint: testSprint() });

    service.setStatus('s1', 'ACTIVE').subscribe();
    const status = httpTesting.expectOne('/api/v1/sprints/s1/status');
    expect(status.request.body).toEqual({ status: 'ACTIVE' });
    status.flush({ sprint: testSprint({ status: 'ACTIVE' }) });

    service.delete('s1').subscribe();
    const remove = httpTesting.expectOne((req) => req.method === 'DELETE');
    expect(remove.request.url).toBe('/api/v1/sprints/s1');
    remove.flush(null, { status: 204, statusText: 'No Content' });
  });
});
