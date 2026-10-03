import { BreakpointObserver } from '@angular/cdk/layout';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { Role } from '../../core/models/user';
import { NotificationService } from '../../core/services/notification.service';
import { ToastService } from '../../core/services/toast.service';
import { FakeAuthService, fakeAuthService, testUser } from '../../testing/test-data';
import { MainLayout } from './main-layout';

describe('MainLayout', () => {
  let auth: FakeAuthService;
  let toastInfo: ReturnType<typeof vi.fn>;
  let refreshUnreadCount: ReturnType<typeof vi.fn>;
  const unreadCount = signal(0);

  async function render(isHandset: boolean, role: Role = 'PROJECT_MANAGER') {
    auth = fakeAuthService(testUser({ role }));
    toastInfo = vi.fn();
    refreshUnreadCount = vi.fn(() => of(3));
    unreadCount.set(3);
    TestBed.configureTestingModule({
      imports: [MainLayout],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: ToastService, useValue: { info: toastInfo } },
        { provide: NotificationService, useValue: { unreadCount, refreshUnreadCount } },
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

  const navLinks = (element: HTMLElement) =>
    [...element.querySelectorAll('mat-nav-list a')].map((link) => ({
      label: link.querySelector('[matListItemTitle]')?.textContent?.trim(),
      href: link.getAttribute('href'),
    }));

  it('shows the application name and the navigation links', async () => {
    const element: HTMLElement = (await render(false)).nativeElement;

    expect(element.querySelector('.brand')?.textContent).toContain('Smart Project Manager');
    expect(navLinks(element)).toEqual([
      { label: 'Home', href: '/' },
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Projects', href: '/projects' },
      { label: 'My profile', href: '/profile' },
    ]);
  });

  it('shows "Users" to administrators only and "My tasks" to developers only', async () => {
    const admin: HTMLElement = (await render(false, 'ADMIN')).nativeElement;
    expect(navLinks(admin).map((link) => link.label)).toEqual([
      'Home',
      'Dashboard',
      'Projects',
      'My profile',
      'Users',
    ]);
    expect(navLinks(admin)).toContainEqual({ label: 'Users', href: '/admin/users' });

    TestBed.resetTestingModule();
    const developer: HTMLElement = (await render(false, 'DEVELOPER')).nativeElement;
    expect(navLinks(developer)).toEqual([
      { label: 'Home', href: '/' },
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Projects', href: '/projects' },
      { label: 'My tasks', href: '/my-tasks' },
      { label: 'My profile', href: '/profile' },
    ]);
  });

  it('shows the unread notifications on the bell, refreshed in the background', async () => {
    const element: HTMLElement = (await render(false)).nativeElement;
    // The first refresh is scheduled right away (timer 0).
    await vi.waitFor(() => expect(refreshUnreadCount).toHaveBeenCalled());
    const bell = element.querySelector('a.notifications-button')!;
    expect(bell.getAttribute('href')).toBe('/notifications');
    expect(bell.getAttribute('aria-label')).toBe('Notifications, 3 unread');
    expect(bell.querySelector('.mat-badge-content')?.textContent).toBe('3');
  });

  it('searches from the toolbar', async () => {
    const fixture = await render(false);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const element: HTMLElement = fixture.nativeElement;

    const input = element.querySelector<HTMLInputElement>('.toolbar-search input')!;
    input.value = '  payment ';
    element.querySelector('.toolbar-search')!.dispatchEvent(new Event('submit'));

    expect(navigate).toHaveBeenCalledWith(['/search'], { queryParams: { q: 'payment' } });
  });

  it('shows the menu button only on handsets', async () => {
    const desktop: HTMLElement = (await render(false)).nativeElement;
    expect(desktop.querySelector('button[aria-label="Open the menu"]')).toBeNull();

    TestBed.resetTestingModule();
    const handset: HTMLElement = (await render(true)).nativeElement;
    expect(handset.querySelector('button[aria-label="Open the menu"]')).not.toBeNull();
  });

  it('shows the user in the account menu and logs out', async () => {
    const fixture = await render(false);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('.user-button')?.textContent).toContain('Sara');
    element.querySelector<HTMLButtonElement>('.user-button')?.click();
    await fixture.whenStable();

    const menu = document.querySelector('.mat-mdc-menu-panel') as HTMLElement;
    expect(menu.textContent).toContain('Sara Manager');
    expect(menu.textContent).toContain('Project manager');
    expect(menu.querySelector('a[href="/profile"]')?.textContent).toContain('My profile');

    [...menu.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.includes('Log out'))
      ?.click();

    expect(auth.logout).toHaveBeenCalled();
    expect(toastInfo).toHaveBeenCalledWith('You have been logged out.');
    expect(navigate).toHaveBeenCalledWith('/login');
  });
});
