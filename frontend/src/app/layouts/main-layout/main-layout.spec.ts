import { BreakpointObserver } from '@angular/cdk/layout';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { FakeAuthService, fakeAuthService, testUser } from '../../testing/test-data';
import { MainLayout } from './main-layout';

describe('MainLayout', () => {
  let auth: FakeAuthService;
  let toastInfo: ReturnType<typeof vi.fn>;

  async function render(isHandset: boolean) {
    auth = fakeAuthService(testUser());
    toastInfo = vi.fn();
    TestBed.configureTestingModule({
      imports: [MainLayout],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: ToastService, useValue: { info: toastInfo } },
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

  it('shows the application name and the navigation links', async () => {
    const element: HTMLElement = (await render(false)).nativeElement;

    expect(element.querySelector('.brand')?.textContent).toContain('Smart Project Manager');
    const links = [...element.querySelectorAll('mat-nav-list a')];
    expect(links.map((link) => link.textContent?.trim())).toEqual([
      expect.stringContaining('Home'),
    ]);
    expect(links[0].getAttribute('href')).toBe('/');
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

    [...menu.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.includes('Log out'))
      ?.click();

    expect(auth.logout).toHaveBeenCalled();
    expect(toastInfo).toHaveBeenCalledWith('You have been logged out.');
    expect(navigate).toHaveBeenCalledWith('/login');
  });
});
