import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';

import { ApiError } from '../../../core/models/api-error';
import { Developer } from '../../../core/models/project';
import { ToastService } from '../../../core/services/toast.service';
import { testMember, testProject } from '../../../testing/test-data';
import { DeveloperService } from '../developer.service';
import { ProjectService } from '../project.service';
import { AddMembersDialog } from './add-members-dialog';

describe('AddMembersDialog', () => {
  let fixture: ComponentFixture<AddMembersDialog>;
  let search: ReturnType<typeof vi.fn>;
  let addMember: ReturnType<typeof vi.fn>;
  let onAdded: ReturnType<typeof vi.fn>;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  const youssef: Developer = {
    id: 'd1',
    firstName: 'Youssef',
    lastName: 'Alami',
    email: 'youssef@example.com',
    jobTitle: 'Full-stack developer',
    skills: [{ name: 'Angular', level: 'ADVANCED' }],
  };
  const lina: Developer = {
    id: 'd2',
    firstName: 'Lina',
    lastName: 'Ben',
    email: 'lina@example.com',
    jobTitle: '',
    skills: [{ name: 'Node.js', level: 'EXPERT' }],
  };
  const page = (data: Developer[]) => ({
    data,
    pagination: { page: 1, limit: 8, total: data.length, totalPages: 1 },
  });

  async function render(developers: Developer[] = [youssef, lina]) {
    search = vi.fn(() => of(page(developers)));
    addMember = vi.fn();
    onAdded = vi.fn();
    toast = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      imports: [AddMembersDialog],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: { project: testProject({ members: [testMember()] }), onAdded },
        },
        { provide: DeveloperService, useValue: { search } },
        { provide: ProjectService, useValue: { addMember } },
        { provide: ToastService, useValue: toast },
      ],
    });
    fixture = TestBed.createComponent(AddMembersDialog);
    await fixture.whenStable();
  }

  const element = () => fixture.nativeElement as HTMLElement;
  const rows = () => [...element().querySelectorAll('li.developer')].map((row) => row.textContent);
  const addButton = (name: string) =>
    element().querySelector<HTMLButtonElement>(`[aria-label="Add ${name}"]`);

  async function type(name: 'search' | 'skill', value: string) {
    const input = element().querySelector<HTMLInputElement>(`input[formControlName="${name}"]`)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await new Promise((resolve) => setTimeout(resolve, 350));
    await fixture.whenStable();
  }

  it('lists the active developers with their skills; members are marked', async () => {
    await render();

    expect(search).toHaveBeenCalledWith({ page: 1, limit: 8, search: '', skill: '' });
    expect(element().querySelector('h2')?.textContent).toContain(
      'Add developers to E-commerce platform',
    );
    expect(rows()[0]).toContain('Youssef Alami');
    expect(rows()[0]).toContain('In the team');
    expect(addButton('Youssef Alami')).toBeNull();
    expect(rows()[1]).toContain('Node.js');
    expect(rows()[1]).toContain('Expert');
    expect(addButton('Lina Ben')).not.toBeNull();
  });

  it('searches by name and by skill (each field debounced)', async () => {
    await render();

    await type('search', 'node');
    expect(search).toHaveBeenLastCalledWith({ page: 1, limit: 8, search: 'node', skill: '' });

    // Same text in the other field: must still trigger a new search.
    await type('skill', 'node');
    expect(search).toHaveBeenLastCalledWith({ page: 1, limit: 8, search: 'node', skill: 'node' });
  });

  it('adds a developer: the project page is updated and the developer marked as member', async () => {
    await render();
    const updated = testProject({
      members: [testMember(), { ...testMember(), ...lina, isActive: true }],
    });
    addMember.mockReturnValue(of(updated));

    addButton('Lina Ben')!.click();
    await fixture.whenStable();

    expect(addMember).toHaveBeenCalledWith('p1', 'd2');
    expect(onAdded).toHaveBeenCalledWith(updated);
    expect(toast.success).toHaveBeenCalledWith('Lina Ben has been added to the team.');
    expect(rows()[1]).toContain('In the team');
  });

  it('reports a refused addition and lets the user try again', async () => {
    await render();
    addMember.mockReturnValue(
      throwError(
        () => new ApiError(409, 'CONFLICT', 'This user is already a member of the project'),
      ),
    );

    addButton('Lina Ben')!.click();
    await fixture.whenStable();

    expect(toast.error).toHaveBeenCalledWith('This user is already a member of the project');
    expect(onAdded).not.toHaveBeenCalled();
    expect(addButton('Lina Ben')!.disabled).toBe(false);
  });

  it('says when no developer matches', async () => {
    await render([]);

    expect(element().textContent).toContain('No active developer matches this search.');
  });
});
