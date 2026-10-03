import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { actionErrorMessage } from '../../../core/http/action-error';
import { ApiError } from '../../../core/models/api-error';
import {
  AiPlan,
  ApplyPlanInput,
  PLAN_LIMITS,
  PlanTask,
  PlanTaskInput,
} from '../../../core/models/ai-plan';
import { SPRINT_LIMITS } from '../../../core/models/sprint';
import {
  STORY_POINTS,
  TASK_LIMITS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_TYPES,
  TASK_TYPE_LABELS,
  TaskPriority,
  TaskType,
} from '../../../core/models/task';
import { AiStatus } from '../../../core/models/system-status';
import { HealthService } from '../../../core/services/health.service';
import { ToastService } from '../../../core/services/toast.service';
import { LoadingState } from '../../../shared/components/loading-state/loading-state';
import { TagInput } from '../../../shared/components/tag-input/tag-input';
import { addDays } from '../../../shared/dates';
import { firstErrorMessage, formSubmitError } from '../../../shared/forms/form-errors';
import {
  integerValidator,
  notBeforeValidator,
  tagListValidator,
} from '../../../shared/forms/validators';
import { ProjectContext } from '../../projects/project-context';
import { AiPlanService } from '../ai-plan.service';

type TaskForm = FormGroup<{
  title: FormControl<string>;
  description: FormControl<string>;
  type: FormControl<TaskType>;
  priority: FormControl<TaskPriority>;
  complexity: FormControl<number>;
  requiredSkills: FormControl<string[]>;
  epic: FormControl<string>;
}>;

type SprintForm = FormGroup<{
  name: FormControl<string>;
  objective: FormControl<string>;
  startDate: FormControl<string>;
  endDate: FormControl<string>;
  tasks: FormArray<TaskForm>;
}>;

type ReviewForm = FormGroup<{ sprints: FormArray<SprintForm>; backlog: FormArray<TaskForm> }>;

/** A list of tasks of the review: one per sprint, then the backlog. */
interface TaskList {
  label: string;
  tasks: FormArray<TaskForm>;
  /** Absent for the backlog. */
  sprint?: SprintForm;
  index: number;
}

const required = (maxLength: number) => [
  Validators.required,
  Validators.pattern(/\S/),
  Validators.maxLength(maxLength),
];

/**
 * "Plan with AI" (AI-01), manager only: (1) the manager pastes the specification and/or
 * attaches a file; the AI service proposes sprints and tasks; (2) the manager reviews the plan
 * (edits, moves, deletes) and applies it. Nothing is created before "Apply the plan".
 */
@Component({
  selector: 'app-ai-plan-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatSelectModule,
    LoadingState,
    TagInput,
  ],
  templateUrl: './ai-plan-page.html',
  styleUrl: './ai-plan-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiPlanPage {
  private readonly context = inject(ProjectContext);
  private readonly aiPlanService = inject(AiPlanService);
  private readonly healthService = inject(HealthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly limits = PLAN_LIMITS;
  protected readonly taskLimits = TASK_LIMITS;
  protected readonly types = TASK_TYPES;
  protected readonly typeLabels = TASK_TYPE_LABELS;
  protected readonly priorities = TASK_PRIORITIES;
  protected readonly priorityLabels = TASK_PRIORITY_LABELS;
  protected readonly storyPoints = STORY_POINTS;
  protected readonly accept = PLAN_LIMITS.extensions.join(',');
  protected readonly canEdit = this.context.canEdit;

  // ---------- step 1: specification ----------
  protected readonly inputForm = this.fb.group({
    text: ['', Validators.maxLength(PLAN_LIMITS.textMaxLength)],
    /** '' = chosen by the backend. */
    startDate: [''],
    sprintLengthDays: [
      PLAN_LIMITS.sprintLengthDays.default,
      [
        Validators.required,
        Validators.min(PLAN_LIMITS.sprintLengthDays.min),
        Validators.max(PLAN_LIMITS.sprintLengthDays.max),
        integerValidator,
      ],
    ],
    capacityPerSprint: [
      PLAN_LIMITS.capacityPerSprint.default,
      [
        Validators.required,
        Validators.min(PLAN_LIMITS.capacityPerSprint.min),
        Validators.max(PLAN_LIMITS.capacityPerSprint.max),
        integerValidator,
      ],
    ],
  });
  protected readonly file = signal<File | null>(null);
  protected readonly fileError = signal<string | null>(null);
  protected readonly aiStatus = signal<AiStatus | null>(null);
  protected readonly generating = signal(false);
  protected readonly inputError = signal<string | null>(null);

  // ---------- step 2: review ----------
  protected readonly plan = signal<AiPlan | null>(null);
  protected readonly review = signal<ReviewForm | null>(null);
  protected readonly applying = signal(false);
  protected readonly reviewError = signal<string | null>(null);
  /** Tasks whose editor is open. */
  protected readonly expanded = signal<ReadonlySet<TaskForm>>(new Set());

  constructor() {
    this.healthService
      .checkAi()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (status) => this.aiStatus.set(status),
        error: () => this.aiStatus.set({ available: false, reason: 'UNREACHABLE', llm: null }),
      });
  }

  protected numberError(field: 'sprintLengthDays' | 'capacityPerSprint'): string {
    const { min, max } = PLAN_LIMITS[field];
    const message = `A whole number between ${min} and ${max}`;
    return firstErrorMessage(this.inputForm.controls[field], {
      required: message,
      min: message,
      max: message,
      integer: message,
    });
  }

  protected textError(): string {
    return firstErrorMessage(this.inputForm.controls.text, {
      maxlength: `At most ${PLAN_LIMITS.textMaxLength} characters`,
    });
  }

  protected selectFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const selected = input.files?.[0] ?? null;
    // Cleared so that choosing the same file again still triggers a change.
    input.value = '';
    if (!selected) return;
    const extension = selected.name.slice(selected.name.lastIndexOf('.')).toLowerCase();
    if (!(PLAN_LIMITS.extensions as readonly string[]).includes(extension)) {
      this.fileError.set(`Unsupported file type: use ${PLAN_LIMITS.extensions.join(', ')}`);
      return;
    }
    if (selected.size > PLAN_LIMITS.maxFileBytes) {
      this.fileError.set(`The file exceeds ${PLAN_LIMITS.maxFileBytes / (1024 * 1024)} MB`);
      return;
    }
    this.fileError.set(null);
    this.inputError.set(null);
    this.file.set(selected);
  }

  protected removeFile(): void {
    this.file.set(null);
  }

  protected generate(): void {
    const value = this.inputForm.getRawValue();
    if (this.inputForm.invalid) {
      this.inputForm.markAllAsTouched();
      return;
    }
    if (!this.file() && value.text.trim().length < PLAN_LIMITS.textMinLength) {
      this.inputError.set(
        `Paste the specification (at least ${PLAN_LIMITS.textMinLength} characters) or attach a file.`,
      );
      return;
    }
    this.inputError.set(null);
    this.generating.set(true);
    this.aiPlanService
      .generate(this.context.current.id, { ...value, file: this.file() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (plan) => {
          this.plan.set(plan);
          this.review.set(this.buildReview(plan));
          this.expanded.set(new Set());
          this.reviewError.set(null);
          this.generating.set(false);
        },
        error: (error: unknown) => {
          this.inputError.set(formSubmitError(this.inputForm, error));
          this.generating.set(false);
        },
      });
  }

  /** Back to the specification; the input is kept. */
  protected back(): void {
    this.plan.set(null);
    this.review.set(null);
  }

  // ---------- review ----------
  protected lists(review: ReviewForm): TaskList[] {
    return [
      ...review.controls.sprints.controls.map((sprint, index) => ({
        label: sprint.controls.name.value.trim() || `Sprint #${index + 1}`,
        tasks: sprint.controls.tasks,
        sprint,
        index,
      })),
      { label: 'Backlog', tasks: review.controls.backlog, index: -1 },
    ];
  }

  protected points(tasks: FormArray<TaskForm>): number {
    return tasks.controls.reduce((total, task) => total + task.controls.complexity.value, 0);
  }

  protected taskCount(review: ReviewForm): number {
    return this.lists(review).reduce((count, list) => count + list.tasks.length, 0);
  }

  protected isExpanded(task: TaskForm): boolean {
    return this.expanded().has(task) || (task.invalid && task.touched);
  }

  protected toggle(task: TaskForm): void {
    const next = new Set(this.expanded());
    if (!next.delete(task)) next.add(task);
    this.expanded.set(next);
  }

  protected moveTask(task: TaskForm, from: FormArray<TaskForm>, to: FormArray<TaskForm>): void {
    from.removeAt(from.controls.indexOf(task));
    to.push(task);
    to.markAsDirty();
  }

  protected deleteTask(task: TaskForm, from: FormArray<TaskForm>): void {
    from.removeAt(from.controls.indexOf(task));
    from.markAsDirty();
  }

  /** Removes a sprint; its tasks go to the backlog. */
  protected removeSprint(review: ReviewForm, index: number): void {
    const sprint = review.controls.sprints.at(index);
    sprint.controls.tasks.controls.forEach((task) => review.controls.backlog.push(task));
    review.controls.sprints.removeAt(index);
  }

  /** New empty sprint after the last one, with the length chosen for the plan. */
  protected addSprint(review: ReviewForm): void {
    const plan = this.plan();
    if (!plan || review.controls.sprints.length >= PLAN_LIMITS.maxSprints) return;
    const sprints = review.controls.sprints.controls;
    const last = sprints.at(-1);
    const startDate = last?.controls.endDate.value
      ? addDays(last.controls.endDate.value, 1)
      : plan.options.startDate;
    const number = /^Sprint (\d+)$/.exec(last?.controls.name.value ?? '')?.[1];
    review.controls.sprints.push(
      this.sprintForm({
        name: number ? `Sprint ${Number(number) + 1}` : 'New sprint',
        objective: '',
        startDate,
        endDate: addDays(startDate, plan.options.sprintLengthDays - 1),
        tasks: [],
      }),
    );
  }

  protected apply(review: ReviewForm): void {
    const plan = this.plan();
    if (!plan) return;
    if (review.invalid) {
      review.markAllAsTouched();
      this.reviewError.set('Some fields need your attention (highlighted below).');
      return;
    }
    const count = this.taskCount(review);
    if (count === 0 || count > PLAN_LIMITS.maxTasks) {
      this.reviewError.set(
        count === 0
          ? 'The plan contains no task.'
          : `A plan can create at most ${PLAN_LIMITS.maxTasks} tasks (${count} in this plan).`,
      );
      return;
    }
    this.reviewError.set(null);
    this.applying.set(true);
    this.aiPlanService
      .apply(this.context.current.id, this.toInput(review, plan))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          const sprints = result.sprints.length;
          this.toast.success(
            `Plan applied: ${result.tasksCreated} ${result.tasksCreated === 1 ? 'task' : 'tasks'} ` +
              `and ${sprints} ${sprints === 1 ? 'sprint' : 'sprints'} created.`,
          );
          void this.router.navigate(['../sprints'], { relativeTo: this.route });
        },
        error: (error: unknown) => {
          this.applying.set(false);
          if (error instanceof ApiError && error.status === 400) {
            this.reviewError.set(formSubmitError(review, error) ?? 'Some fields were refused.');
            return;
          }
          const message = actionErrorMessage(error);
          if (message) this.reviewError.set(message);
        },
      });
  }

  protected taskError(task: TaskForm, field: 'title' | 'description'): string {
    return firstErrorMessage(task.controls[field], {
      required: 'Title is required',
      pattern: 'Title is required',
      maxlength: `At most ${field === 'title' ? TASK_LIMITS.titleMaxLength : TASK_LIMITS.descriptionMaxLength} characters`,
    });
  }

  protected sprintError(sprint: SprintForm, field: 'name' | 'endDate' | 'objective'): string {
    return firstErrorMessage(sprint.controls[field], {
      required: 'Required',
      pattern: 'Required',
      maxlength: 'Too long',
      notBefore: 'On or after the start date',
    });
  }

  // ---------- form <-> plan ----------
  private buildReview(plan: AiPlan): ReviewForm {
    return new FormGroup({
      sprints: new FormArray(plan.sprints.map((sprint) => this.sprintForm(sprint))),
      backlog: new FormArray(plan.backlog.map((task) => this.taskForm(task))),
    });
  }

  private sprintForm(sprint: AiPlan['sprints'][number]): SprintForm {
    const form: SprintForm = this.fb.group({
      name: [sprint.name, required(SPRINT_LIMITS.nameMaxLength)],
      objective: [sprint.objective, Validators.maxLength(SPRINT_LIMITS.objectiveMaxLength)],
      startDate: [sprint.startDate, Validators.required],
      endDate: [sprint.endDate, [Validators.required, notBeforeValidator('startDate')]],
      tasks: new FormArray(sprint.tasks.map((task) => this.taskForm(task))),
    });
    form.controls.startDate.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => form.controls.endDate.updateValueAndValidity());
    return form;
  }

  private taskForm(task: PlanTask): TaskForm {
    return this.fb.group({
      title: [task.title, required(TASK_LIMITS.titleMaxLength)],
      description: [task.description, Validators.maxLength(TASK_LIMITS.descriptionMaxLength)],
      type: [task.type],
      priority: [task.priority],
      complexity: [task.complexity],
      requiredSkills: [
        task.requiredSkills,
        tagListValidator(TASK_LIMITS.maxRequiredSkills, TASK_LIMITS.skillMaxLength),
      ],
      epic: [task.epic],
    });
  }

  private toInput(review: ReviewForm, plan: AiPlan): ApplyPlanInput {
    const task = (form: TaskForm): PlanTaskInput => {
      const value = form.getRawValue();
      return {
        title: value.title.trim(),
        description: value.description.trim(),
        type: value.type,
        priority: value.priority,
        complexity: value.complexity,
        requiredSkills: value.requiredSkills,
      };
    };
    return {
      method: plan.method,
      sprints: review.controls.sprints.controls.map((sprint) => ({
        name: sprint.controls.name.value.trim(),
        objective: sprint.controls.objective.value.trim(),
        startDate: sprint.controls.startDate.value,
        endDate: sprint.controls.endDate.value,
        tasks: sprint.controls.tasks.controls.map(task),
      })),
      backlog: review.controls.backlog.controls.map(task),
    };
  }
}
