import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/models/api-error';
import { ToastService } from '../../../core/services/toast.service';
import { fakeAuthService, testProject, testUser } from '../../../testing/test-data';
import { ProjectService } from '../project.service';
import { ProjectForm } from './project-form';

describe('ProjectForm', () => {
  let fixture: ComponentFixture<ProjectForm>;
  let projectService: {
    get: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let toast: { success: ReturnType<typeof vi.fn> };
  let navigate: ReturnType<typeof vi.spyOn>;

  async function render(id?: string) {
    TestBed.configureTestingModule({
      imports: [ProjectForm],
      providers: [
        provideRouter([]),
        { provide: ProjectService, useValue: projectService },
        { provide: AuthService, useValue: fakeAuthService(testUser()) },
        { provide: ToastService, useValue: toast },
      ],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(ProjectForm);
    if (id) fixture.componentRef.setInput('id', id);
    await fixture.whenStable();
  }

  beforeEach(() => {
    projectService = { get: vi.fn(), create: vi.fn(), update: vi.fn() };
    toast = { success: vi.fn() };
  });

  const element = () => fixture.nativeElement as HTMLElement;
  const text = () => element().textContent ?? '';
  const field = (name: string) =>
    element().querySelector<HTMLInputElement>(`[formControlName="${name}"]`)!;
  const chips = () =>
    [...element().querySelectorAll('mat-chip-row')].map((chip) =>
      chip.textContent?.replace('cancel', '').trim(),
    );

  async function type(name: string, value: string) {
    field(name).value = value;
    field(name).dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  async function addTechnology(value: string) {
    const input = element().querySelector<HTMLInputElement>(
      'input[placeholder="Add a technology…"]',
    )!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13 }));
    await fixture.whenStable();
  }

  async function submit() {
    element().querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  it('creates a project: today as default start date, technologies entered as chips', async () => {
    projectService.create.mockReturnValue(of(testProject({ id: 'p9' })));
    await render();

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    expect(field('startDate').value).toBe(
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    );

    await type('name', '  E-commerce  ');
    await type('description', 'Shop');
    await type('startDate', '2026-10-05');
    await type('deadline', '2027-01-31');
    await addTechnology('Angular');
    await addTechnology(' angular ');
    await addTechnology('Node.js');
    expect(chips()).toEqual(['Angular', 'Node.js']);

    await submit();

    expect(projectService.create).toHaveBeenCalledWith({
      name: 'E-commerce',
      description: 'Shop',
      startDate: '2026-10-05',
      deadline: '2027-01-31',
      technologies: ['Angular', 'Node.js'],
    });
    expect(toast.success).toHaveBeenCalledWith('The project has been created.');
    expect(navigate).toHaveBeenCalledWith(['/projects', 'p9']);
  });

  it('removes a technology', async () => {
    await render();
    await addTechnology('Angular');
    await addTechnology('Docker');

    element().querySelector<HTMLButtonElement>('[aria-label="Remove Angular"]')!.click();
    await fixture.whenStable();

    expect(chips()).toEqual(['Docker']);
  });

  it('validates the name and the dates before sending', async () => {
    await render();

    await type('name', '   ');
    await type('startDate', '2026-10-10');
    await type('deadline', '2026-10-01');
    await submit();

    expect(text()).toContain('Project name is required');
    expect(text()).toContain('The deadline must be on or after the start date');
    expect(projectService.create).not.toHaveBeenCalled();

    // Moving the start date re-checks the deadline.
    await type('startDate', '2026-09-30');
    expect(text()).not.toContain('The deadline must be on or after the start date');
  });

  it('shows backend validation messages on the fields', async () => {
    projectService.create.mockReturnValue(
      throwError(
        () =>
          new ApiError(400, 'BAD_REQUEST', 'Validation failed', [
            { field: 'technologies', message: 'Duplicate value in technologies: Go' },
          ]),
      ),
    );
    await render();

    await type('name', 'API');
    await submit();

    expect(text()).toContain('Duplicate value in technologies: Go');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('edits a project: fields filled in, a cleared deadline is removed (null)', async () => {
    projectService.get.mockReturnValue(of(testProject()));
    projectService.update.mockReturnValue(of(testProject()));
    await render('p1');

    expect(field('name').value).toBe('E-commerce platform');
    expect(field('startDate').value).toBe('2026-10-01');
    expect(field('deadline').value).toBe('2027-01-31');
    expect(chips()).toEqual(['Angular', 'Node.js']);

    await type('deadline', '');
    await submit();

    expect(projectService.update).toHaveBeenCalledWith('p1', {
      name: 'E-commerce platform',
      description: 'Online shop with Stripe payment',
      startDate: '2026-10-01',
      deadline: null,
      technologies: ['Angular', 'Node.js'],
    });
    expect(toast.success).toHaveBeenCalledWith('The project has been updated.');
    expect(navigate).toHaveBeenCalledWith(['/projects', 'p1']);
  });

  it("refuses to edit another manager's project or an archived project", async () => {
    projectService.get.mockReturnValue(
      of(testProject({ manager: { ...testProject().manager, id: 'someone-else' } })),
    );
    await render('p1');
    expect(text()).toContain('Only the project manager can edit this project.');
    expect(element().querySelector('form')).toBeNull();

    TestBed.resetTestingModule();
    projectService.get.mockReturnValue(of(testProject({ status: 'ARCHIVED' })));
    await render('p1');
    expect(text()).toContain('This project is archived: change its status before modifying it.');
    expect(element().querySelector('form')).toBeNull();
  });
});
