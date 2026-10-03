import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { testPage } from '../../testing/test-data';
import { ActivityService } from '../activity/activity.service';
import { CommentService } from './comment.service';

describe('CommentService and ActivityService', () => {
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('lists, posts, edits and deletes the comments of a task', () => {
    const comments = TestBed.inject(CommentService);

    comments.list('t1', 2, 20).subscribe();
    const list = httpTesting.expectOne((req) => req.url === '/api/v1/tasks/t1/comments');
    expect(list.request.params.toString()).toBe('page=2&limit=20');
    list.flush(testPage([]));

    comments.create('t1', 'Done').subscribe();
    const create = httpTesting.expectOne('/api/v1/tasks/t1/comments');
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({ content: 'Done' });
    create.flush({ comment: {} });

    comments.update('c1', 'Done!').subscribe();
    const update = httpTesting.expectOne('/api/v1/comments/c1');
    expect(update.request.method).toBe('PATCH');
    expect(update.request.body).toEqual({ content: 'Done!' });
    update.flush({ comment: {} });

    comments.delete('c1').subscribe();
    const remove = httpTesting.expectOne('/api/v1/comments/c1');
    expect(remove.request.method).toBe('DELETE');
    remove.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('reads the history of a project (optionally by type) and of a task', () => {
    const activities = TestBed.inject(ActivityService);

    activities.forProject('p1', 1, 20, 'TASK_CREATED').subscribe();
    const project = httpTesting.expectOne((req) => req.url === '/api/v1/projects/p1/activities');
    expect(project.request.params.toString()).toBe('page=1&limit=20&type=TASK_CREATED');
    project.flush(testPage([]));

    activities.forTask('t1', 1, 10).subscribe();
    const task = httpTesting.expectOne((req) => req.url === '/api/v1/tasks/t1/activities');
    expect(task.request.params.toString()).toBe('page=1&limit=10');
    task.flush(testPage([]));
  });
});
