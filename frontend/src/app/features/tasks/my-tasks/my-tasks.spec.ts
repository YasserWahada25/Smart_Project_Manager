import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatSelectHarness } from '@angular/material/select/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AssignedTask } from '../../../core/models/task';
import { testPage, testTask } from '../../../testing/test-data';
import { TaskService } from '../task.service';
import { MyTasks } from './my-tasks';

describe('MyTasks', () => {
  let fixture: ComponentFixture<MyTasks>;
  let loader: HarnessLoader;
  let assigned: ReturnType<typeof vi.fn>;

  const myTask: AssignedTask = {
    ...testTask({ isOverdue: true }),
    project: { id: 'p1', name: 'E-commerce platform', status: 'ACTIVE' },
    sprint: { id: 's1', name: 'Sprint 1', status: 'ACTIVE' },
  };

  async function render(tasks: AssignedTask[] = [myTask]) {
    assigned = vi.fn(() => of(testPage(tasks)));
    TestBed.configureTestingModule({
      imports: [MyTasks],
      providers: [
        provideRouter([]),
        { provide: TaskService, useValue: { assigned } },
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
      ],
    });
    fixture = TestBed.createComponent(MyTasks);
    loader = TestbedHarnessEnvironment.loader(fixture);
    await fixture.whenStable();
  }

  const element = () => fixture.nativeElement as HTMLElement;

  it('lists my tasks with their project, sprint and deadline, linking to the task page', async () => {
    await render();

    expect(assigned).toHaveBeenCalledWith({ page: 1, limit: 20, status: undefined });
    const link = element().querySelector('a.task')!;
    const content = link.textContent?.replace(/\s+/g, ' ');
    expect(link.getAttribute('href')).toBe('/projects/p1/tasks/t1');
    expect(content).toContain('Implement login page');
    expect(content).toContain('E-commerce platform · Sprint 1');
    expect(content).toContain('To do');
    expect(content).toContain('5 pts');
    expect(content).toContain('Nov 15, 2026');
    expect(content).toContain('(overdue)');
  });

  it('filters by status', async () => {
    await render();

    const status = await loader.getHarness(MatSelectHarness);
    await status.open();
    await status.clickOptions({ text: 'Blocked' });

    expect(assigned).toHaveBeenLastCalledWith({ page: 1, limit: 20, status: 'BLOCKED' });
  });

  it('says when nothing is assigned', async () => {
    await render([]);

    expect(element().textContent).toContain('No task assigned to you.');
  });
});
