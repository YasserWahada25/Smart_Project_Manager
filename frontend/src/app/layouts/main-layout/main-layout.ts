import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';

import { APP_NAME } from '../../core/app.constants';
import { AuthService } from '../../core/auth/auth.service';
import { ROLE_LABELS } from '../../core/models/user';
import { ToastService } from '../../core/services/toast.service';

interface NavItem {
  label: string;
  icon: string;
  path: string;
}

/** Navigation entries: one per implemented feature page (extended as features are added). */
export const NAV_ITEMS: readonly NavItem[] = [{ label: 'Home', icon: 'home', path: '/' }];

/**
 * Application shell for authenticated users: toolbar (with user menu) + side navigation +
 * routed page. The side menu is always visible on large screens and becomes a drawer on handsets.
 */
@Component({
  selector: 'app-main-layout',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatDividerModule,
  ],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainLayout {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly appName = APP_NAME;
  protected readonly navItems = NAV_ITEMS;
  protected readonly user = this.auth.currentUser;
  protected readonly roleLabel = computed(() => {
    const user = this.user();
    return user ? ROLE_LABELS[user.role] : '';
  });

  protected readonly isHandset = toSignal(
    inject(BreakpointObserver)
      .observe(Breakpoints.Handset)
      .pipe(map((result) => result.matches)),
    { initialValue: false },
  );

  protected logout(): void {
    this.auth.logout();
    this.toast.info('You have been logged out.');
    void this.router.navigateByUrl('/login');
  }
}
