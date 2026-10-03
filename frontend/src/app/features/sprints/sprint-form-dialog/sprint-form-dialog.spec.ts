import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';

import { ApiError } from '../../../core/models/api-error';
import { addDays, todayIsoDate } from '../../../shared/dates';
import { testSprint } from '../../../testing/test-data';
import { SprintService } from '../sprint.service';
import { SprintFormData, SprintFormDialog } from './sprint-form-dialog';

describe('SprintFormDialog', () => {
  let fixture: ComponentFixture<SprintFormDialog>;
  let sprintService: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let close: ReturnType<typeof vi.fn>;

  async function render(data: SprintFormData) {
    sprintService = { create: vi.fn(), update: vi.fn() };
    close = vi.fn();
    TestBed.configureTestingModule({
      imports: [SprintFormDialog],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close } },
        { provide: SprintService, useValue: sprintService },
      ],
    });
    fixture = TestBed.createComponent(SprintFormDialog);
    await fixture.whenStable();
  }

  const element = () => fixture.nativeElement as HTMLElement;
  const field = (name: string) =>
    element().querySelector<HTMLInputElement>(`[formControlName="${name}"]`)!;

  async function type(name: string, value: string) {
    field(name).value = value;
    field(name).dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  async function submit() {
    element().querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  it('proposes a two-week sprint starting today and creates it', async () => {
    await render({ projectId: 'p1' });
    const saved = testSprint();
    sprintService.create.mockReturnValue(of(saved));

    expect(element().querySelector('h2')?.textContent).toBe('New sprint');
    expect(field('startDate').value).toBe(todayIsoDate());
    expect(field('endDate').value).toBe(addDays(todayIsoDate(), 13));

    await type('name', '  Sprint 1 ');
    await type('objective', 'Login');
    await type('startDate', '2026-10-05');
    await type('endDate', '2026-10-18');
    await submit();

    expect(sprintService.create).toHaveBeenCalledWith('p1', {
      name: 'Sprint 1',
      objective: 'Login',
      startDate: '2026-10-05',
      endDate: '2026-10-18',
    });
    expect(close).toHaveBeenCalledWith(saved);
  });

  it('validates the name and the dates', async () => {
    await render({ projectId: 'p1' });

    await type('name', ' ');
    await type('startDate', '2026-10-18');
    await type('endDate', '2026-10-05');
    await submit();

    expect(element().textContent).toContain('Sprint name is required');
    expect(element().textContent).toContain('The end date must be on or after the start date');
    expect(sprintService.create).not.toHaveBeenCalled();
  });

  it('edits a sprint; backend errors are shown', async () => {
    await render({ projectId: 'p1', sprint: testSprint() });
    sprintService.update.mockReturnValue(
      throwError(
        () =>
          new ApiError(409, 'CONFLICT', 'The sprint is completed and can no longer be modified'),
      ),
    );

    expect(element().querySelector('h2')?.textContent).toBe('Edit the sprint');
    expect(field('name').value).toBe('Sprint 1');
    expect(field('startDate').value).toBe('2026-10-05');
    expect(field('endDate').value).toBe('2026-10-18');

    await submit();

    expect(sprintService.update).toHaveBeenCalledWith('s1', {
      name: 'Sprint 1',
      objective: 'Authentication and catalog',
      startDate: '2026-10-05',
      endDate: '2026-10-18',
    });
    expect(element().querySelector('[role="alert"]')?.textContent).toContain(
      'The sprint is completed and can no longer be modified',
    );
    expect(close).not.toHaveBeenCalled();
  });
});
