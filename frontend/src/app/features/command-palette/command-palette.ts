import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { SearchResults } from '../../core/models/dashboard';
import { Project } from '../../core/models/project';
import { Role } from '../../core/models/user';
import { ThemeMode, ThemeService } from '../../core/services/theme.service';
import { identityColor, initials } from '../../shared/colors';
import { DashboardService } from '../dashboard/dashboard.service';
import { ProjectService } from '../projects/project.service';

export interface PaletteItem {
  id: string;
  group: 'Actions' | 'This project' | 'Projects' | 'Tasks' | 'Search';
  label: string;
  hint?: string;
  icon: string;
  /** Colored project square instead of an icon. */
  color?: string;
  run: () => void;
}

interface ActionDef {
  label: string;
  icon: string;
  path: string;
  roles?: readonly Role[];
}

const ACTIONS: readonly ActionDef[] = [
  { label: 'Go to Home', icon: 'home', path: '/' },
  { label: 'Go to Inbox', icon: 'inbox', path: '/notifications' },
  { label: 'Go to My tasks', icon: 'task_alt', path: '/my-tasks', roles: ['DEVELOPER'] },
  { label: 'Go to Dashboard', icon: 'insights', path: '/dashboard' },
  { label: 'Go to Projects', icon: 'folder_open', path: '/projects' },
  { label: 'Create a project', icon: 'add', path: '/projects/new', roles: ['PROJECT_MANAGER'] },
  { label: 'Open my profile', icon: 'person', path: '/profile' },
  { label: 'Manage users', icon: 'manage_accounts', path: '/admin/users', roles: ['ADMIN'] },
];

const THEME_LABELS: Record<ThemeMode, string> = {
  system: 'Use the system theme',
  light: 'Switch to the light theme',
  dark: 'Switch to the dark theme',
};

const MIN_QUERY = 2;

/**
 * Command palette (Ctrl+K), inspired by Linear: type to filter actions and projects, find tasks
 * (global search), jump anywhere; ↑ ↓ to choose, Enter to run, Esc to close. Inside a project it
 * also offers that project's tabs and AI features.
 */
@Component({
  selector: 'app-command-palette',
  imports: [MatIconModule],
  template: `
    <div class="search">
      <mat-icon aria-hidden="true">search</mat-icon>
      <input
        role="combobox"
        aria-label="Search or run a command"
        aria-controls="palette-results"
        aria-autocomplete="list"
        [attr.aria-expanded]="items().length > 0"
        [attr.aria-activedescendant]="items().length ? 'palette-item-' + active() : null"
        placeholder="Search projects, tasks, or type a command…"
        [value]="query()"
        (input)="onInput($event)"
        (keydown)="onKeydown($event)"
      />
      <kbd aria-hidden="true">Esc</kbd>
    </div>
    <ul id="palette-results" role="listbox" aria-label="Results">
      @for (item of items(); track item.id; let index = $index) {
        @if (index === 0 || items()[index - 1].group !== item.group) {
          <li class="group" role="presentation">{{ item.group }}</li>
        }
        <li
          [id]="'palette-item-' + index"
          role="option"
          class="item"
          [class.active]="index === active()"
          [attr.aria-selected]="index === active()"
          (mousemove)="active.set(index)"
          (click)="run(item)"
          (keydown.enter)="run(item)"
          tabindex="-1"
        >
          @if (item.color) {
            <span class="project-mark" [style.background]="item.color" aria-hidden="true">{{
              item.icon
            }}</span>
          } @else {
            <mat-icon aria-hidden="true">{{ item.icon }}</mat-icon>
          }
          <span class="label">{{ item.label }}</span>
          @if (item.hint) {
            <span class="hint">{{ item.hint }}</span>
          }
        </li>
      } @empty {
        <li class="empty" role="presentation">No result.</li>
      }
    </ul>
    <p class="footer" aria-hidden="true">
      <kbd>↑</kbd><kbd>↓</kbd> navigate <kbd>Enter</kbd> open <kbd>Esc</kbd> close
    </p>
  `,
  styles: `
    .search {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 16px;
      border-bottom: 1px solid var(--spm-border);
      color: var(--spm-muted);
    }
    input {
      flex: 1;
      border: 0;
      outline: none;
      background: transparent;
      color: var(--mat-sys-on-surface);
      font: 400 16px/1.4 var(--mat-sys-body-large-font, inherit);
    }
    ul {
      max-height: min(420px, 60vh);
      margin: 0;
      padding: 6px;
      overflow-y: auto;
      list-style: none;
    }
    .group {
      padding: 10px 10px 4px;
      font: 600 11px/1 var(--mat-sys-label-small-font, inherit);
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--spm-muted);
    }
    .item {
      display: flex;
      align-items: center;
      gap: 10px;
      height: 38px;
      padding: 0 10px;
      border-radius: 6px;
      cursor: pointer;
    }
    .item.active {
      background: color-mix(in srgb, var(--mat-sys-primary) 12%, transparent);
    }
    .item mat-icon {
      width: 18px;
      height: 18px;
      font-size: 18px;
      color: var(--spm-muted);
    }
    .label {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .hint,
    .empty,
    .footer {
      font: var(--mat-sys-body-small);
      color: var(--spm-muted);
    }
    .empty {
      padding: 16px 10px;
    }
    .footer {
      display: flex;
      gap: 6px;
      align-items: center;
      margin: 0;
      padding: 8px 16px;
      border-top: 1px solid var(--spm-border);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommandPalette {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly theme = inject(ThemeService);
  private readonly dialogRef = inject(MatDialogRef<CommandPalette>);
  private readonly dashboardService = inject(DashboardService);

  protected readonly query = signal<string>(
    inject<{ query?: string } | null>(MAT_DIALOG_DATA)?.query ?? '',
  );
  protected readonly active = signal(0);
  private readonly projects = signal<Project[]>([]);
  private readonly tasks = signal<SearchResults['tasks']['items']>([]);
  /** Project of the current page (/projects/:id/…), for the contextual actions. */
  private readonly currentProjectId =
    /^\/projects\/([a-f\d]{24})/i.exec(this.router.url)?.[1] ?? null;

  protected readonly items = computed<PaletteItem[]>(() => {
    const q = this.query().trim().toLowerCase();
    const matches = (label: string) => !q || label.toLowerCase().includes(q);
    const role = this.auth.currentUser()?.role;
    const go = (path: string | string[]) => () =>
      void this.router.navigate(Array.isArray(path) ? path : [path]);

    const context: PaletteItem[] = [];
    const project = this.projects().find((item) => item.id === this.currentProjectId);
    if (this.currentProjectId) {
      const id = this.currentProjectId;
      const name = project?.name ?? 'this project';
      context.push(
        {
          id: 'ctx-board',
          group: 'This project',
          label: `Open the board of ${name}`,
          icon: 'view_kanban',
          run: go(['/projects', id, 'board']),
        },
        {
          id: 'ctx-sprints',
          group: 'This project',
          label: `Open the sprints of ${name}`,
          icon: 'flag',
          run: go(['/projects', id, 'sprints']),
        },
      );
      if (role === 'PROJECT_MANAGER') {
        context.push(
          {
            id: 'ctx-plan',
            group: 'This project',
            label: 'Plan with AI',
            icon: 'auto_awesome',
            run: go(['/projects', id, 'ai-plan']),
          },
          {
            id: 'ctx-ask',
            group: 'This project',
            label: 'Ask the AI assistant',
            icon: 'forum',
            run: go(['/projects', id, 'assistant']),
          },
        );
      }
    }

    const actions: PaletteItem[] = ACTIONS.filter(
      (action) => !action.roles || (role && action.roles.includes(role)),
    ).map((action) => ({
      id: `go-${action.path}`,
      group: 'Actions',
      label: action.label,
      icon: action.icon,
      run: go(action.path),
    }));
    (['light', 'dark', 'system'] as const)
      .filter((mode) => mode !== this.theme.mode())
      .forEach((mode) =>
        actions.push({
          id: `theme-${mode}`,
          group: 'Actions',
          label: THEME_LABELS[mode],
          icon: mode === 'dark' ? 'dark_mode' : mode === 'light' ? 'light_mode' : 'brightness_auto',
          run: () => this.theme.setMode(mode),
        }),
      );

    const projects: PaletteItem[] = this.projects().map((item) => ({
      id: `project-${item.id}`,
      group: 'Projects',
      label: item.name,
      hint: item.status === 'ARCHIVED' ? 'Archived' : undefined,
      icon: initials(item.name).slice(0, 1),
      color: identityColor(item.id),
      run: go(['/projects', item.id]),
    }));

    const tasks: PaletteItem[] =
      q.length >= MIN_QUERY
        ? this.tasks().map((task) => ({
            id: `task-${task.id}`,
            group: 'Tasks',
            label: task.title,
            hint: task.project.name,
            icon: 'task_alt',
            run: go(['/projects', task.project.id, 'tasks', task.id]),
          }))
        : [];

    const search: PaletteItem[] =
      q.length >= MIN_QUERY
        ? [
            {
              id: 'search',
              group: 'Search',
              label: `Search everywhere for “${this.query().trim()}”`,
              icon: 'search',
              run: () =>
                void this.router.navigate(['/search'], { queryParams: { q: this.query().trim() } }),
            },
          ]
        : [];

    return [
      ...context.filter((item) => matches(item.label)),
      ...projects.filter((item) => matches(item.label)).slice(0, q ? 8 : 5),
      ...tasks,
      ...actions.filter((item) => matches(item.label)),
      ...search,
    ];
  });

  constructor() {
    inject(ProjectService)
      .list({ page: 1, limit: 100 })
      .pipe(takeUntilDestroyed())
      .subscribe({ next: (page) => this.projects.set(page.data), error: () => undefined });

    toObservable(this.query)
      .pipe(
        map((value) => value.trim()),
        debounceTime(200),
        distinctUntilChanged(),
        switchMap((q) =>
          q.length < MIN_QUERY
            ? of([])
            : this.dashboardService.search(q, 5).pipe(
                map((results) => results.tasks.items),
                catchError(() => of([])),
              ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((tasks) => this.tasks.set(tasks));

    // Keep the highlighted row inside the list when the results change.
    effect(() => {
      const count = this.items().length;
      if (this.active() >= count) this.active.set(Math.max(count - 1, 0));
    });
  }

  protected onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.active.set(0);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.items().length;
    if (event.key === 'ArrowDown' && count) {
      event.preventDefault();
      this.active.set((this.active() + 1) % count);
    } else if (event.key === 'ArrowUp' && count) {
      event.preventDefault();
      this.active.set((this.active() - 1 + count) % count);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item = this.items()[this.active()];
      if (item) this.run(item);
    }
  }

  protected run(item: PaletteItem): void {
    this.dialogRef.close();
    item.run();
  }
}
