import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  FormGroupDirective,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import {
  SKILL_LEVELS,
  SKILL_LEVEL_LABELS,
  Skill,
  SkillLevel,
  User,
} from '../../../core/models/user';
import { ToastService } from '../../../core/services/toast.service';
import { firstErrorMessage, formSubmitError } from '../../../shared/forms/form-errors';
import { integerValidator } from '../../../shared/forms/validators';
import { ProfileService } from '../profile.service';

/** Backend limits (validators/profile.validator.js). */
export const MAX_SKILLS = 50;
const NAME_MAX_LENGTH = 50;
const MAX_YEARS = 50;

type SkillForm = FormGroup<{
  name: FormControl<string>;
  level: FormControl<SkillLevel>;
  yearsOfExperience: FormControl<number | null>;
}>;

/** Skill names must be unique, ignoring case and surrounding spaces (same rule as the backend). */
function uniqueSkillNames(control: AbstractControl): ValidationErrors | null {
  const seen = new Set<string>();
  for (const skill of (control as FormArray<SkillForm>).controls) {
    const name = skill.controls.name.value.trim();
    const key = name.toLowerCase();
    if (!key) continue;
    if (seen.has(key)) return { duplicateSkill: name };
    seen.add(key);
  }
  return null;
}

/** Edits the whole skill list, saved at once (PUT /profile/skills). */
@Component({
  selector: 'app-skills-form',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './skills-form.html',
  styleUrls: ['../profile-form.scss', './skills-form.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkillsForm implements OnInit {
  readonly user = input.required<User>();
  readonly saved = output<User>();

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly profileService = inject(ProfileService);
  private readonly toast = inject(ToastService);

  protected readonly maxSkills = MAX_SKILLS;
  protected readonly levels = SKILL_LEVELS;
  protected readonly levelLabels = SKILL_LEVEL_LABELS;
  protected readonly form = this.fb.group({
    skills: this.fb.array<SkillForm>([], uniqueSkillNames),
  });
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  private readonly formDirective = viewChild(FormGroupDirective);

  protected get skills(): FormArray<SkillForm> {
    return this.form.controls.skills;
  }

  ngOnInit(): void {
    this.reset(this.user().skills);
  }

  protected add(): void {
    this.skills.push(this.skillForm());
    this.form.markAsDirty();
  }

  protected remove(index: number): void {
    this.skills.removeAt(index);
    this.form.markAsDirty();
  }

  protected cancel(): void {
    this.errorMessage.set(null);
    this.reset(this.user().skills);
  }

  protected nameError(skill: SkillForm): string {
    return firstErrorMessage(skill.controls.name, {
      required: 'Skill name is required',
      pattern: 'Skill name is required',
      maxlength: `At most ${NAME_MAX_LENGTH} characters`,
    });
  }

  protected levelError(skill: SkillForm): string {
    return firstErrorMessage(skill.controls.level, { required: 'Choose a level' });
  }

  protected yearsError(skill: SkillForm): string {
    return firstErrorMessage(skill.controls.yearsOfExperience, {
      min: 'At least 0',
      max: `At most ${MAX_YEARS}`,
      integer: 'Whole number of years',
    });
  }

  /** Error about the list itself (duplicate name), from this form or from the backend. */
  protected listError(): string {
    const errors = this.skills.errors;
    if (!errors) return '';
    if (typeof errors['server'] === 'string') return errors['server'];
    if (typeof errors['duplicateSkill'] === 'string') {
      return `Duplicate skill: ${errors['duplicateSkill']}`;
    }
    return '';
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set(null);

    const skills: Skill[] = this.skills.getRawValue().map(({ name, level, yearsOfExperience }) => ({
      name: name.trim(),
      level,
      ...(yearsOfExperience === null ? {} : { yearsOfExperience }),
    }));
    this.profileService.updateSkills(skills).subscribe({
      next: (user) => {
        this.submitting.set(false);
        this.reset(user.skills);
        this.toast.success('Your skills have been saved.');
        this.saved.emit(user);
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        this.errorMessage.set(formSubmitError(this.form, error));
      },
    });
  }

  private reset(skills: Skill[]): void {
    this.skills.clear({ emitEvent: false });
    for (const skill of skills) this.skills.push(this.skillForm(skill), { emitEvent: false });
    // resetForm() also clears the "submitted" state (errors of a new empty skill stay hidden).
    // In ngOnInit the directive exists but is not bound to the form yet.
    const directive = this.formDirective();
    if (directive?.form) directive.resetForm(this.form.getRawValue());
    this.skills.updateValueAndValidity();
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  private skillForm(skill?: Skill): SkillForm {
    return this.fb.group({
      name: [
        skill?.name ?? '',
        [Validators.required, Validators.pattern(/\S/), Validators.maxLength(NAME_MAX_LENGTH)],
      ],
      level: [skill?.level ?? ('INTERMEDIATE' as SkillLevel), Validators.required],
      yearsOfExperience: this.fb.control<number | null>(skill?.yearsOfExperience ?? null, [
        Validators.min(0),
        Validators.max(MAX_YEARS),
        integerValidator,
      ]),
    });
  }
}
