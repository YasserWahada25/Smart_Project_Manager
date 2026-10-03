import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { debounceTime, distinctUntilChanged, finalize, merge } from 'rxjs';

import { actionErrorMessage } from '../../../core/http/action-error';
import { Developer, Project } from '../../../core/models/project';
import { SKILL_LEVEL_LABELS } from '../../../core/models/user';
import { ToastService } from '../../../core/services/toast.service';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { PagedList } from '../../../shared/data/paged-list';
import { DeveloperQuery, DeveloperService } from '../developer.service';
import { ProjectService } from '../project.service';

export interface AddMembersDialogData {
  project: Project;
  /** Called with the updated project after each successful addition. */
  onAdded: (project: Project) => void;
}

/**
 * Developer directory (active developers) filtered by name/email and by skill, to add team
 * members one by one. The dialog stays open so several developers can be added.
 */
@Component({
  selector: 'app-add-members-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressBarModule,
    ErrorState,
  ],
  templateUrl: './add-members-dialog.html',
  styleUrl: './add-members-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddMembersDialog {
  private readonly data = inject<AddMembersDialogData>(MAT_DIALOG_DATA);
  private readonly developerService = inject(DeveloperService);
  private readonly projectService = inject(ProjectService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly levelLabels = SKILL_LEVEL_LABELS;
  private readonly project = signal(this.data.project);
  protected readonly projectName = computed(() => this.project().name);
  protected readonly memberIds = computed(
    () => new Set(this.project().members.map((member) => member.id)),
  );

  protected readonly filters = inject(NonNullableFormBuilder).group({
    search: [''],
    skill: [''],
  });
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = 8;
  private readonly list = new PagedList<DeveloperQuery, Developer>(
    (query) => this.developerService.search(query),
    this.destroyRef,
  );
  protected readonly developers = this.list.items;
  protected readonly total = this.list.total;
  protected readonly loading = this.list.loading;
  protected readonly errorMessage = this.list.errorMessage;
  /** Developer being added (all "Add" buttons are disabled meanwhile). */
  protected readonly addingId = signal<string | null>(null);

  constructor() {
    // Debounced per field: typing the same text in both fields must still trigger a search.
    const typed = (control: typeof this.filters.controls.search) =>
      control.valueChanges.pipe(debounceTime(300), distinctUntilChanged());
    merge(typed(this.filters.controls.search), typed(this.filters.controls.skill))
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.pageIndex.set(0);
        this.load();
      });

    this.load();
  }

  protected load(): void {
    const { search, skill } = this.filters.getRawValue();
    this.list.load({ page: this.pageIndex() + 1, limit: this.pageSize, search, skill });
  }

  protected changePage({ pageIndex }: PageEvent): void {
    this.pageIndex.set(pageIndex);
    this.load();
  }

  protected add(developer: Developer): void {
    const name = `${developer.firstName} ${developer.lastName}`;
    this.addingId.set(developer.id);
    this.projectService
      .addMember(this.project().id, developer.id)
      .pipe(
        finalize(() => this.addingId.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (project) => {
          this.project.set(project);
          this.data.onAdded(project);
          this.toast.success(`${name} has been added to the team.`);
        },
        error: (error: unknown) => {
          const message = actionErrorMessage(error);
          if (message) this.toast.error(message);
        },
      });
  }
}
