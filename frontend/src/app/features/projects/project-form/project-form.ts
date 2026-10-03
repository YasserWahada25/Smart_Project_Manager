import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/models/api-error';
import { PROJECT_LIMITS, ProjectInput } from '../../../core/models/project';
import { ToastService } from '../../../core/services/toast.service';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { LoadingState } from '../../../shared/components/loading-state/loading-state';
import { TagInput } from '../../../shared/components/tag-input/tag-input';
import { toDateInput, todayIsoDate } from '../../../shared/dates';
import { firstErrorMessage, formSubmitError } from '../../../shared/forms/form-errors';
import { notBeforeValidator, tagListValidator } from '../../../shared/forms/validators';
import { ProjectService } from '../project.service';

type Field = 'name' | 'description' | 'startDate' | 'deadline';

/**
 * Creation (`/projects/new`) and edition (`/projects/:id/edit`) of a project, for its
 * project manager. The status and the team are managed from the project page.
 */
@Component({
  selector: 'app-project-form',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    TagInput,
    MatButtonModule,
    LoadingState,
    ErrorState,
  ],
  templateUrl: './project-form.html',
  styleUrl: './project-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectForm implements OnInit {
  /** Route parameter (absent on /projects/new). */
  readonly id = input<string>();

  private readonly projectService = inject(ProjectService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly limits = PROJECT_LIMITS;
  protected readonly form = inject(NonNullableFormBuilder).group({
    name: [
      '',
      [
        Validators.required,
        Validators.pattern(/\S/),
        Validators.maxLength(PROJECT_LIMITS.nameMaxLength),
      ],
    ],
    description: ['', Validators.maxLength(PROJECT_LIMITS.descriptionMaxLength)],
    startDate: [todayIsoDate(), Validators.required],
    deadline: ['', notBeforeValidator('startDate')],
    technologies: [
      [] as string[],
      tagListValidator(PROJECT_LIMITS.maxTechnologies, PROJECT_LIMITS.technologyMaxLength),
    ],
  });

  protected readonly isEdit = computed(() => this.id() !== undefined);
  protected readonly loading = signal(false);
  protected readonly loadError = signal<{ message: string; retryable: boolean } | null>(null);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  private readonly messages: Record<Field, Record<string, string>> = {
    name: {
      required: 'Project name is required',
      pattern: 'Project name is required',
      maxlength: `At most ${PROJECT_LIMITS.nameMaxLength} characters`,
    },
    description: { maxlength: `At most ${PROJECT_LIMITS.descriptionMaxLength} characters` },
    startDate: { required: 'Start date is required' },
    deadline: { notBefore: 'The deadline must be on or after the start date' },
  };

  constructor() {
    // The deadline must be re-checked when the start date changes.
    this.form.controls.startDate.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.form.controls.deadline.updateValueAndValidity());
  }

  ngOnInit(): void {
    const id = this.id();
    if (id) this.load(id);
  }

  protected load(id: string): void {
    this.loading.set(true);
    this.loadError.set(null);

    this.projectService
      .get(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (project) => {
          this.loading.set(false);
          if (project.manager.id !== this.auth.currentUser()?.id) {
            this.loadError.set({
              message: 'Only the project manager can edit this project.',
              retryable: false,
            });
          } else if (project.status === 'ARCHIVED') {
            this.loadError.set({
              message: 'This project is archived: change its status before modifying it.',
              retryable: false,
            });
          } else {
            this.form.reset({
              name: project.name,
              description: project.description,
              startDate: toDateInput(project.startDate),
              deadline: toDateInput(project.deadline),
              technologies: project.technologies,
            });
          }
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.loadError.set(loadErrorOf(error));
        },
      });
  }

  protected error(field: Field): string {
    return firstErrorMessage(this.form.controls[field], this.messages[field]);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set(null);

    const { name, description, startDate, deadline, technologies } = this.form.getRawValue();
    const data: ProjectInput = {
      name: name.trim(),
      description: description.trim(),
      startDate,
      deadline: deadline || null,
      technologies,
    };
    const id = this.id();
    const request = id ? this.projectService.update(id, data) : this.projectService.create(data);

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (project) => {
        this.toast.success(id ? 'The project has been updated.' : 'The project has been created.');
        void this.router.navigate(['/projects', project.id]);
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        this.errorMessage.set(formSubmitError(this.form, error));
      },
    });
  }

  protected cancelLink(): string[] {
    const id = this.id();
    return id ? ['/projects', id] : ['/projects'];
  }
}

function loadErrorOf(error: unknown): { message: string; retryable: boolean } {
  if (!(error instanceof ApiError)) {
    return { message: 'An unexpected error occurred.', retryable: true };
  }
  return { message: error.message, retryable: error.isNetworkError || error.status >= 500 };
}
