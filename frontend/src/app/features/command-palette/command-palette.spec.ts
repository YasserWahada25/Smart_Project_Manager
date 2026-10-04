import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { User } from '../../core/models/user';
import { ThemeService } from '../../core/services/theme.service';
import { fakeAuthService, testPage, testProject, testUser } from '../../testing/test-data';
import { DashboardService } from '../dashboard/dashboard.service';
import { ProjectService } from '../projects/project.service';
import { CommandPalette } from './command-palette';

describe('CommandPalette', () => {
  let fixture: ComponentFixture<CommandPalette>;
  let close: ReturnType<typeof vi.fn>;
  let search: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.spyOn>;

  async function render(user: User = testUser(), url = '/') {
    close = vi.fn();
    search = vi.fn(() =>
      of({
        query: 'login',
        projects: { total: 0, items: [] },
        tasks: {
          total: 1,
          items: [
            {
              id: 't1',
              title: 'Implement login page',
              status: 'TODO',
              priority: 'HIGH',
              type: 'FEATURE',
              project: { id: 'p1', name: 'E-commerce platform' },
              assignee: null,
            },
          ],
        },
      }),
    );
    TestBed.configureTestingModule({
      imports: [CommandPalette],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: fakeAuthService(user) },
        { provide: MatDialogRef, useValue: { close } },
        { provide: MAT_DIALOG_DATA, useValue: { query: '' } },
        {
          provide: ProjectService,
          useValue: {
            list: () =>
              of(
                testPage([
                  testProject({ id: '6a0000000000000000000001', name: 'E-commerce platform' }),
                  testProject({ id: '6a0000000000000000000002', name: 'Mobile app' }),
                ]),
              ),
          },
        },
        { provide: DashboardService, useValue: { search } },
      ],
    });
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'url', 'get').mockReturnValue(url);
    navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(CommandPalette);
    await fixture.whenStable();
  }

  const element = () => fixture.nativeElement as HTMLElement;
  const input = () => element().querySelector('input')!;
  const labels = () =>
    [...element().querySelectorAll('[role="option"] .label')].map((item) =>
      item.textContent?.trim(),
    );
  const groups = () =>
    [...element().querySelectorAll('.group')].map((item) => item.textContent?.trim());

  async function type(value: string) {
    input().value = value;
    input().dispatchEvent(new Event('input'));
    await new Promise((resolve) => setTimeout(resolve, 250)); // search debounce
    await fixture.whenStable();
  }

  function press(key: string) {
    input().dispatchEvent(new KeyboardEvent('keydown', { key }));
  }

  it('lists projects and actions allowed to the role', async () => {
    await render();
    expect(groups()).toEqual(['Projects', 'Actions']);
    expect(labels()).toContain('E-commerce platform');
    expect(labels()).toContain('Create a project');
    expect(labels()).not.toContain('Manage users');
    expect(labels()).not.toContain('Go to My tasks');
  });

  it('filters by the text, finds tasks and offers a global search', async () => {
    await render();
    await type('login');

    expect(search).toHaveBeenCalledWith('login', 5);
    expect(groups()).toEqual(['Tasks', 'Search']);
    expect(labels()).toEqual(['Implement login page', 'Search everywhere for “login”']);
    expect(input().getAttribute('aria-activedescendant')).toBe('palette-item-0');

    press('ArrowDown');
    press('Enter');
    expect(close).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/search'], { queryParams: { q: 'login' } });
  });

  it('opens a task with Enter and wraps around with the arrows', async () => {
    await render();
    await type('login');
    press('ArrowUp'); // wraps to the last item
    press('ArrowDown'); // back to the first one
    press('Enter');
    expect(navigate).toHaveBeenCalledWith(['/projects', 'p1', 'tasks', 't1']);
  });

  it('offers the actions of the current project to its manager', async () => {
    await render(testUser(), '/projects/6a0000000000000000000001/board');
    expect(groups()[0]).toBe('This project');
    expect(labels()).toContain('Plan with AI');
    expect(labels()).toContain('Ask the AI assistant');
    expect(labels()).toContain('Open the sprints of E-commerce platform');

    TestBed.resetTestingModule();
    await render(testUser({ role: 'DEVELOPER' }), '/projects/6a0000000000000000000001');
    expect(labels()).not.toContain('Plan with AI');
    expect(labels()).toContain('Go to My tasks');
  });

  it('switches the theme and shows nothing for an unknown text', async () => {
    await render();
    const noTask = {
      query: 'x',
      projects: { total: 0, items: [] },
      tasks: { total: 0, items: [] },
    };
    search.mockReturnValue(of(noTask));
    await type('dark theme');
    expect(labels()).toEqual(['Switch to the dark theme', 'Search everywhere for “dark theme”']);
    press('Enter');
    expect(TestBed.inject(ThemeService).mode()).toBe('dark');
    TestBed.inject(ThemeService).setMode('system');

    await type('zz');
    expect(element().textContent).toContain('Search everywhere for “zz”');
    await type('q');
    expect(element().textContent).toContain('No result.');
  });
});
