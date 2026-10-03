import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatSelectHarness } from '@angular/material/select/testing';
import { of } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { Activity } from '../../../core/models/activity';
import { fakeAuthService, testPage, testProject, testUser } from '../../../testing/test-data';
import { ProjectContext } from '../../projects/project-context';
import { ActivityService } from '../activity.service';
import { TaskHistory } from '../task-history/task-history';
import { ProjectActivity } from './project-activity';

const entry = (id: string, overrides: Partial<Activity> = {}): Activity => ({
  id,
  type: 'TASK_STATUS_CHANGED',
  project: 'p1',
  task: 't1',
  actor: { id: 'd1', firstName: 'Youssef', lastName: 'Alami' },
  details: { title: 'Login', from: 'TODO', to: 'IN_PROGRESS' },
  createdAt: '2026-10-02T10:00:00.000Z',
  ...overrides,
});

describe('ProjectActivity', () => {
  let fixture: ComponentFixture<ProjectActivity>;
  let loader: HarnessLoader;
  let forProject: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    forProject = vi.fn((_project: string, page: number) =>
      of(
        page === 1
          ? testPage(
              [entry('a1'), entry('a2', { type: 'COMMENT_ADDED', details: { title: 'Login' } })],
              3,
            )
          : testPage([entry('a3', { type: 'PROJECT_CREATED', details: { name: 'Shop' } })], 3),
      ),
    );
    TestBed.configureTestingModule({
      imports: [ProjectActivity],
      providers: [
        ProjectContext,
        { provide: AuthService, useValue: fakeAuthService(testUser()) },
        { provide: ActivityService, useValue: { forProject } },
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
      ],
    });
    TestBed.inject(ProjectContext).project.set(testProject());
    fixture = TestBed.createComponent(ProjectActivity);
    loader = TestbedHarnessEnvironment.loader(fixture);
    await fixture.whenStable();
  });

  const text = () => (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ') ?? '';

  it('shows the history of the project, then older entries on demand', async () => {
    expect(forProject).toHaveBeenCalledWith('p1', 1, 20, undefined);
    expect(text()).toContain('Youssef Alami moved «Login» from To do to In progress');
    expect(text()).toContain('Youssef Alami commented on «Login»');

    [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')]
      .find((b) => b.textContent?.includes('Show older entries'))!
      .click();
    await fixture.whenStable();

    expect(forProject).toHaveBeenLastCalledWith('p1', 2, 20, undefined);
    expect(text()).toContain('created the project «Shop»');
    expect(text()).not.toContain('Show older entries');
  });

  it('filters by event type from the first page', async () => {
    const type = await loader.getHarness(MatSelectHarness);
    await type.open();
    await type.clickOptions({ text: 'Comment added' });

    expect(forProject).toHaveBeenLastCalledWith('p1', 1, 20, 'COMMENT_ADDED');
  });
});

describe('TaskHistory', () => {
  it('loads the history of the task and reloads it when the task page changes it', async () => {
    const forTask = vi.fn(() => of(testPage([entry('a1')])));
    TestBed.configureTestingModule({
      imports: [TaskHistory],
      providers: [{ provide: ActivityService, useValue: { forTask } }],
    });
    const fixture = TestBed.createComponent(TaskHistory);
    fixture.componentRef.setInput('taskId', 't1');
    await fixture.whenStable();

    expect(forTask).toHaveBeenCalledWith('t1', 1, 10);
    expect(fixture.nativeElement.textContent).toContain('moved «Login» from To do to In progress');

    fixture.componentRef.setInput('version', 1);
    await fixture.whenStable();
    expect(forTask).toHaveBeenCalledTimes(2);
  });
});
