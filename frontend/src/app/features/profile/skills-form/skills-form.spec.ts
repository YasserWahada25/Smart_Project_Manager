import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { ApiError } from '../../../core/models/api-error';
import { Skill, User } from '../../../core/models/user';
import { ToastService } from '../../../core/services/toast.service';
import { testUser } from '../../../testing/test-data';
import { ProfileService } from '../profile.service';
import { SkillsForm } from './skills-form';

describe('SkillsForm', () => {
  let fixture: ComponentFixture<SkillsForm>;
  let profile: { updateSkills: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn> };

  const angular = { name: 'Angular', level: 'ADVANCED' as const, yearsOfExperience: 3 };

  async function render(user: User = testUser({ skills: [angular] })) {
    profile = { updateSkills: vi.fn() };
    toast = { success: vi.fn() };
    TestBed.configureTestingModule({
      imports: [SkillsForm],
      providers: [
        { provide: ProfileService, useValue: profile },
        { provide: ToastService, useValue: toast },
      ],
    });
    fixture = TestBed.createComponent(SkillsForm);
    fixture.componentRef.setInput('user', user);
    await fixture.whenStable();
  }

  const element = () => fixture.nativeElement as HTMLElement;
  const text = () => element().textContent ?? '';
  const inputs = (name: string) => [
    ...element().querySelectorAll<HTMLInputElement>(`input[formControlName="${name}"]`),
  ];
  const button = (label: string) =>
    [...element().querySelectorAll('button')].find((b) => b.textContent?.trim().endsWith(label))!;

  async function type(input: HTMLInputElement, value: string) {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  async function click(target: HTMLElement) {
    target.click();
    await fixture.whenStable();
  }

  async function submit() {
    element().querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  it('lists the current skills', async () => {
    await render();

    expect(inputs('name').map((input) => input.value)).toEqual(['Angular']);
    expect(inputs('yearsOfExperience')[0].value).toBe('3');
    expect(element().querySelector('mat-select')?.textContent).toContain('Advanced');
    expect(button('Save skills').disabled).toBe(true);
  });

  it('invites to add skills when there are none', async () => {
    await render(testUser());

    expect(text()).toContain('No skills yet');
  });

  it('adds a skill and saves the whole list', async () => {
    await render();
    profile.updateSkills.mockImplementation((skills) => of(testUser({ skills })));
    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);

    await click(button('Add a skill'));
    await type(inputs('name')[1], ' Node.js ');
    await type(inputs('yearsOfExperience')[1], '2');
    await submit();

    const expected: Skill[] = [
      angular,
      { name: 'Node.js', level: 'INTERMEDIATE', yearsOfExperience: 2 },
    ];
    expect(profile.updateSkills).toHaveBeenCalledWith(expected);
    expect(toast.success).toHaveBeenCalledWith('Your skills have been saved.');
    expect(saved).toHaveBeenCalledWith(testUser({ skills: expected }));
    expect(button('Save skills').disabled).toBe(true);
  });

  it('after a save, a new empty skill shows no error until the next submission', async () => {
    await render();
    profile.updateSkills.mockImplementation((skills) => of(testUser({ skills })));

    await click(button('Add a skill'));
    await submit();
    expect(text()).toContain('Skill name is required');

    await type(inputs('name')[1], 'Git');
    await submit();
    await click(button('Add a skill'));

    expect(inputs('name')).toHaveLength(3);
    expect(text()).not.toContain('Skill name is required');
  });

  it('removes a skill; years of experience are optional', async () => {
    await render(testUser({ skills: [angular, { name: 'Git', level: 'EXPERT' }] }));
    profile.updateSkills.mockImplementation((skills) => of(testUser({ skills })));

    await click(element().querySelector<HTMLButtonElement>('[aria-label="Remove Angular"]')!);
    await submit();

    expect(profile.updateSkills).toHaveBeenCalledWith([{ name: 'Git', level: 'EXPERT' }]);
  });

  it('refuses duplicate names (case-insensitive) and invalid years', async () => {
    await render();

    await click(button('Add a skill'));
    await type(inputs('name')[1], ' angular ');
    await type(inputs('yearsOfExperience')[0], '2.5');
    await submit();

    expect(text()).toContain('Duplicate skill: angular');
    expect(text()).toContain('Whole number of years');
    expect(profile.updateSkills).not.toHaveBeenCalled();
  });

  it('shows backend messages on the matching skill and on the list', async () => {
    await render(testUser({ skills: [angular, { name: 'Git', level: 'EXPERT' }] }));
    profile.updateSkills.mockReturnValue(
      throwError(
        () =>
          new ApiError(400, 'BAD_REQUEST', 'Validation failed', [
            { field: 'skills[1].name', message: 'Skill name is required (at most 50 characters)' },
            { field: 'skills', message: 'Duplicate skill: git' },
          ]),
      ),
    );

    await type(inputs('name')[1], 'Git ');
    await submit();

    expect(text()).toContain('Skill name is required (at most 50 characters)');
    expect(text()).toContain('Duplicate skill: git');
  });

  it('Cancel restores the saved skills', async () => {
    await render();

    await click(button('Add a skill'));
    await click(button('Cancel'));

    expect(inputs('name').map((input) => input.value)).toEqual(['Angular']);
  });
});
