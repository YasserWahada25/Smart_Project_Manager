import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/models/api-error';
import { Comment } from '../../../core/models/comment';
import { Project } from '../../../core/models/project';
import { User } from '../../../core/models/user';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../shared/components/confirm-dialog/confirm-dialog';
import {
  fakeAuthService,
  testMember,
  testPage,
  testProject,
  testUser,
} from '../../../testing/test-data';
import { ProjectContext } from '../../projects/project-context';
import { CommentService } from '../comment.service';
import { TaskComments } from './task-comments';

describe('TaskComments', () => {
  let fixture: ComponentFixture<TaskComments>;
  let commentService: Record<'list' | 'create' | 'update' | 'delete', ReturnType<typeof vi.fn>>;
  let toast: { error: ReturnType<typeof vi.fn> };

  const comment = (overrides: Partial<Comment> = {}): Comment => ({
    id: 'c1',
    task: 't1',
    project: 'p1',
    author: { id: 'd1', firstName: 'Youssef', lastName: 'Alami', email: 'youssef@example.com' },
    content: 'Login form done, waiting for review',
    createdAt: '2026-10-02T10:00:00.000Z',
    updatedAt: '2026-10-02T10:00:00.000Z',
    ...overrides,
  });

  async function render(
    user: User = testUser({ id: 'd1', role: 'DEVELOPER' }),
    project: Project = testProject({ members: [testMember()] }),
    comments: Comment[] = [comment()],
  ) {
    commentService = {
      list: vi.fn(() => of(testPage(comments))),
      create: vi.fn(() => of(comment({ id: 'c2' }))),
      update: vi.fn((id: string, content: string) => of(comment({ id, content, editedAt: 'x' }))),
      delete: vi.fn(() => of(undefined)),
    };
    toast = { error: vi.fn() };
    TestBed.configureTestingModule({
      imports: [TaskComments],
      providers: [
        ProjectContext,
        { provide: AuthService, useValue: fakeAuthService(user) },
        { provide: CommentService, useValue: commentService },
        { provide: ConfirmService, useValue: { confirm: () => of(true) } },
        { provide: ToastService, useValue: toast },
      ],
    });
    TestBed.inject(ProjectContext).project.set(project);
    fixture = TestBed.createComponent(TaskComments);
    fixture.componentRef.setInput('taskId', 't1');
    await fixture.whenStable();
  }

  const element = () => fixture.nativeElement as HTMLElement;
  const text = () => element().textContent ?? '';
  const button = (label: string) =>
    [...element().querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.trim() === label || b.getAttribute('aria-label') === label,
    );

  async function write(value: string, textarea = element().querySelector('textarea')!) {
    textarea.value = value;
    textarea.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  it('lists the comments of the task', async () => {
    await render();

    expect(commentService.list).toHaveBeenCalledWith('t1', 1, 20);
    expect(text()).toContain('Youssef Alami');
    expect(text()).toContain('Login form done, waiting for review');
  });

  it('lets a member post a comment, then reloads and notifies the page', async () => {
    await render();
    const commented = vi.fn();
    fixture.componentInstance.commented.subscribe(commented);

    await write('  Ready for review  ');
    button('Comment')!.click();
    await fixture.whenStable();

    expect(commentService.create).toHaveBeenCalledWith('t1', 'Ready for review');
    expect(commentService.list).toHaveBeenCalledTimes(2);
    expect(commented).toHaveBeenCalled();
    expect(element().querySelector('textarea')!.value).toBe('');
  });

  it('refuses an empty comment', async () => {
    await render();

    await write('   ');
    button('Comment')!.click();
    await fixture.whenStable();

    expect(text()).toContain('Write a comment');
    expect(commentService.create).not.toHaveBeenCalled();
  });

  it('lets the author edit and delete their comment', async () => {
    await render();

    button('Edit the comment')!.click();
    await fixture.whenStable();
    const editor = element().querySelector('li textarea') as HTMLTextAreaElement;
    expect(editor.value).toBe('Login form done, waiting for review');
    await write('Updated text', editor);
    button('Save')!.click();
    await fixture.whenStable();

    expect(commentService.update).toHaveBeenCalledWith('c1', 'Updated text');
    expect(text()).toContain('Updated text');
    expect(text()).toContain('(edited)');

    button('Delete the comment')!.click();
    await fixture.whenStable();
    expect(commentService.delete).toHaveBeenCalledWith('c1');
    expect(text()).toContain('No comment yet.');
  });

  it('lets the project manager moderate (delete) but not edit the comments of others', async () => {
    await render(testUser());

    expect(button('Edit the comment')).toBeUndefined();
    expect(button('Delete the comment')).toBeDefined();
    expect(button('Comment')).toBeDefined();
  });

  it('does not let an administrator comment, nor anyone in an archived project', async () => {
    await render(testUser({ id: 'a1', role: 'ADMIN' }));
    expect(button('Comment')).toBeUndefined();
    expect(button('Delete the comment')).toBeUndefined();

    TestBed.resetTestingModule();
    await render(undefined, testProject({ members: [testMember()], status: 'ARCHIVED' }));
    expect(button('Comment')).toBeUndefined();
    expect(button('Edit the comment')).toBeUndefined();
  });

  it('shows the refusal of the backend', async () => {
    await render();
    commentService.create.mockReturnValue(
      throwError(() => new ApiError(409, 'CONFLICT', 'The project is archived')),
    );

    await write('Hello');
    button('Comment')!.click();
    await fixture.whenStable();

    expect(toast.error).toHaveBeenCalledWith('The project is archived');
  });
});
