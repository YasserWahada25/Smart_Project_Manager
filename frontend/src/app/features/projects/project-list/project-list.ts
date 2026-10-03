import { DatePipe } from '@angular/common';
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
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, merge } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  Project,
  ProjectStatus,
} from '../../../core/models/project';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { PagedList } from '../../../shared/data/paged-list';
import { ProjectQuery, ProjectService } from '../project.service';

/** Technologies shown on a card before "+N". */
const VISIBLE_TECHNOLOGIES = 4;

/**
 * Projects visible to the user (the backend filters them: all for an administrator, managed
 * projects for a project manager, projects they belong to for a developer).
 */
@Component({
  selector: 'app-project-list',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressBarModule,
    ErrorState,
  ],
  templateUrl: './project-list.html',
  styleUrl: './project-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectList {
  private readonly projectService = inject(ProjectService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly statuses = PROJECT_STATUSES;
  protected readonly statusLabels = PROJECT_STATUS_LABELS;
  protected readonly pageSizeOptions = [12, 24, 48];
  protected readonly canCreate = computed(() => this.auth.hasRole('PROJECT_MANAGER'));
  protected readonly subtitle = computed(() => {
    if (this.auth.hasRole('ADMIN')) return 'All the projects of the platform.';
    if (this.auth.hasRole('PROJECT_MANAGER')) return 'The projects you manage.';
    return 'The projects you are a member of.';
  });

  protected readonly filters = inject(NonNullableFormBuilder).group({
    search: [''],
    status: ['' as ProjectStatus | ''],
  });
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(12);
  private readonly list = new PagedList<ProjectQuery, Project>(
    (query) => this.projectService.list(query),
    this.destroyRef,
  );
  protected readonly projects = this.list.items;
  protected readonly total = this.list.total;
  protected readonly loading = this.list.loading;
  protected readonly errorMessage = this.list.errorMessage;
  private readonly filtered = signal(false);

  /** Message when the page is empty: no match for the filters, or no project at all. */
  protected readonly emptyMessage = computed(() => {
    if (this.filtered()) return 'No project matches these filters.';
    if (this.canCreate()) return 'You have no project yet. Create your first project.';
    if (this.auth.hasRole('ADMIN')) return 'No project has been created yet.';
    return 'You are not a member of any project yet. A project manager will add you to a team.';
  });

  constructor() {
    const { search, status } = this.filters.controls;
    merge(search.valueChanges.pipe(debounceTime(300), distinctUntilChanged()), status.valueChanges)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.pageIndex.set(0);
        this.load();
      });

    this.load();
  }

  protected load(): void {
    const { search, status } = this.filters.getRawValue();
    this.filtered.set(search.trim() !== '' || status !== '');
    this.list.load({
      page: this.pageIndex() + 1,
      limit: this.pageSize(),
      status: status || undefined,
      search,
    });
  }

  protected changePage({ pageIndex, pageSize }: PageEvent): void {
    this.pageIndex.set(pageIndex);
    this.pageSize.set(pageSize);
    this.load();
  }

  protected visibleTechnologies(project: Project): string[] {
    return project.technologies.slice(0, VISIBLE_TECHNOLOGIES);
  }

  protected hiddenTechnologies(project: Project): number {
    return Math.max(project.technologies.length - VISIBLE_TECHNOLOGIES, 0);
  }
}
