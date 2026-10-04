import { BreakpointObserver } from '@angular/cdk/layout';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { Role } from '../../core/models/user';
import { NotificationService } from '../../core/services/notification.service';
import { THEME_STORAGE_KEY, ThemeService } from '../../core/services/theme.service';
import { ToastService } from '../../core/services/toast.service';
import { CommandPaletteService } from '../../features/command-palette/command-palette.service';
import { ProjectService } from '../../features/projects/project.service';
import {
  FakeAuthService,
  fakeAuthService,
  testPage,
  testProject,
  testUser,
} from '../../testing/test-data';
import { MainLayout, SIDEBAR_STORAGE_KEY } from './main-layout';

describe('MainLayout', () => {
  let auth: FakeAuthService;
  let toastInfo: ReturnType<typeof vi.fn>;
  let refreshUnreadCount: ReturnType<typeof vi.fn>;
  let listProjects: ReturnType<typeof vi.fn>;
  let openPalette: ReturnType<typeof vi.fn>;
  const unreadCount = signal(0);

  const projects = [
    testProject({ id: 'p1', name: 'E-commerce platform' }),
    testProject({ id: 'p2', name: 'Mobile app', status: 'ARCHIVED' }),
  ];

  async function render(isHandset: boolean, role: Role = 'PROJECT_MANAGER', total = 2) {
    auth = fakeAuthService(testUser({ role }));
    toastInfo = vi.fn();
    refreshUnreadCount = vi.fn(() => of(3));
    listProjects = vi.fn(() => of(testPage(projects, total)));
    openPalette = vi.fn(() => Promise.resolve());
    unreadCount.set(3);
    TestBed.configureTestingModule({
      imports: [MainLayout],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: ToastService, useValue: { info: toastInfo } },
        { provide: NotificationService, useValue: { unreadCount, refreshUnreadCount } },
        { provide: ProjectService, useValue: { list: listProjects } },
        { provide: CommandPaletteService, useValue: { open: openPalette } },
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
        {
          provide: BreakpointObserver,
          useValue: { observe: () => of({ matches: isHandset, breakpoints: {} }) },
        },
      ],
    });
    const fixture = TestBed.createComponent(MainLayout);
    await fixture.whenStable();
    return fixture;
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  const navLinks = (element: HTMLElement) =>
    [...element.querySelectorAll('nav[aria-label="Main"] a')].map((link) => ({
      label: link.querySelector('.label')?.textContent?.trim(),
      href: link.getAttribute('href'),
    }));

  it('shows the logo, the application name and the navigation links', async () => {
    const element: HTMLElement = (await render(false)).nativeElement;

    expect(element.querySelector('.brand')?.textContent).toContain('Smart Manager');
    expect(element.querySelector('.brand img')?.getAttribute('src')).toBe('logo-mark.png');
    expect(navLinks(element)).toEqual([
      { label: 'Home', href: '/' },
      { label: 'Inbox', href: '/notifications' },
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Projects', href: '/projects' },
    ]);
  });

  it('shows "Users" to administrators only and "My tasks" to developers only', async () => {
    const admin: HTMLElement = (await render(false, 'ADMIN')).nativeElement;
    expect(navLinks(admin).map((link) => link.label)).toEqual([
      'Home',
      'Inbox',
      'Dashboard',
      'Projects',
      'Users',
    ]);

    TestBed.resetTestingModule();
    const developer: HTMLElement = (await render(false, 'DEVELOPER')).nativeElement;
    expect(navLinks(developer).map((link) => link.label)).toEqual([
      'Home',
      'Inbox',
      'My tasks',
      'Dashboard',
      'Projects',
    ]);
  });

  it('shows the unread notifications on Inbox, refreshed in the background', async () => {
    const element: HTMLElement = (await render(false)).nativeElement;
    // The first refresh is scheduled right away (timer 0).
    await vi.waitFor(() => expect(refreshUnreadCount).toHaveBeenCalled());
    const inbox = element.querySelector('a[href="/notifications"]')!;
    expect(inbox.getAttribute('aria-label')).toBe('Inbox, 3 unread');
    expect(inbox.querySelector('.count')?.textContent?.trim()).toBe('3');
  });

  it('lists the projects with their colored initial, and the creation link for managers', async () => {
    const element: HTMLElement = (await render(false, 'PROJECT_MANAGER', 12)).nativeElement;

    expect(listProjects).toHaveBeenCalledWith({ page: 1, limit: 8 });
    const items = [...element.querySelectorAll('.projects .project-item')];
    expect(items.map((item) => item.getAttribute('href'))).toEqual([
      '/projects/p1',
      '/projects/p2',
    ]);
    expect(items[0].querySelector('.project-mark')?.textContent?.trim()).toBe('E');
    expect(items[0].textContent).toContain('E-commerce platform');
    expect(items[1].classList).toContain('archived');
    expect(element.querySelector('a[aria-label="New project"]')?.getAttribute('href')).toBe(
      '/projects/new',
    );
    expect(element.querySelector('.projects .more')?.textContent).toContain('All projects (12)');

    TestBed.resetTestingModule();
    const developer: HTMLElement = (await render(false, 'DEVELOPER')).nativeElement;
    expect(developer.querySelector('a[aria-label="New project"]')).toBeNull();
  });

  it('opens the command palette from the search field, Ctrl+K, Cmd+K and "/"', async () => {
    const fixture = await render(false);
    const element: HTMLElement = fixture.nativeElement;

    element.querySelector<HTMLButtonElement>('.sidebar-search')!.click();
    expect(element.querySelector('.sidebar-search')?.textContent).toContain('Ctrl K');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'K', metaKey: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '/' }));
    expect(openPalette).toHaveBeenCalledTimes(4);

    // "/" typed in a field is just a character.
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }));
    input.remove();
    expect(openPalette).toHaveBeenCalledTimes(4);
  });

  it('collapses the sidebar to icons and remembers it', async () => {
    const fixture = await render(false);
    const element: HTMLElement = fixture.nativeElement;

    element.querySelector<HTMLButtonElement>('button[aria-label="Collapse the sidebar"]')!.click();
    await fixture.whenStable();

    expect(element.querySelector('.sidenav')?.classList).toContain('compact');
    expect(element.querySelector('nav[aria-label="Main"] .label')).toBeNull();
    expect(element.querySelector('a[aria-label="Dashboard"]')).not.toBeNull();
    expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('collapsed');

    TestBed.resetTestingModule();
    const again: HTMLElement = (await render(false)).nativeElement;
    expect(again.querySelector('button[aria-label="Expand the sidebar"]')).not.toBeNull();
  });

  it('uses a drawer with a menu button on handsets', async () => {
    const desktop: HTMLElement = (await render(false)).nativeElement;
    expect(desktop.querySelector('button[aria-label="Open the menu"]')).toBeNull();

    TestBed.resetTestingModule();
    const handset: HTMLElement = (await render(true)).nativeElement;
    expect(handset.querySelector('button[aria-label="Open the menu"]')).not.toBeNull();
    expect(handset.querySelector('button[aria-label="Collapse the sidebar"]')).toBeNull();
  });

  it('opens the account menu: profile, theme choice and logout', async () => {
    const fixture = await render(false);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('.account')?.textContent).toContain('Sara Manager');
    expect(element.querySelector('.account')?.textContent).toContain('Project manager');
    element.querySelector<HTMLButtonElement>('.account')!.click();
    await fixture.whenStable();

    const menu = document.querySelector('.mat-mdc-menu-panel') as HTMLElement;
    expect(menu.querySelector('a[href="/profile"]')?.textContent).toContain('My profile');
    const dark = [...menu.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
      button.textContent?.includes('Dark'),
    )!;
    dark.click();
    await fixture.whenStable();
    expect(TestBed.inject(ThemeService).mode()).toBe('dark');
    expect(document.documentElement.classList).toContain('theme-dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    element.querySelector<HTMLButtonElement>('.account')!.click();
    await fixture.whenStable();
    [...document.querySelectorAll<HTMLButtonElement>('.mat-mdc-menu-panel button')]
      .find((button) => button.textContent?.includes('Log out'))
      ?.click();

    expect(auth.logout).toHaveBeenCalled();
    expect(toastInfo).toHaveBeenCalledWith('You have been logged out.');
    expect(navigate).toHaveBeenCalledWith('/login');
    TestBed.inject(ThemeService).setMode('system');
  });

  it('offers "Ask AI" to managers: the assistant of one of their active projects', async () => {
    const fixture = await render(false);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const element: HTMLElement = fixture.nativeElement;

    element.querySelector<HTMLButtonElement>('button.ask-ai-fab')!.click();
    await fixture.whenStable();
    const items = [...document.querySelectorAll<HTMLButtonElement>('.mat-mdc-menu-panel button')];
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toContain('E-commerce platform'); // the archived project is not offered
    items[0].click();
    expect(navigate).toHaveBeenCalledWith(['/projects', 'p1', 'assistant']);

    TestBed.resetTestingModule();
    const developer: HTMLElement = (await render(false, 'DEVELOPER')).nativeElement;
    expect(developer.querySelector('button.ask-ai-fab')).toBeNull();
  });
});
