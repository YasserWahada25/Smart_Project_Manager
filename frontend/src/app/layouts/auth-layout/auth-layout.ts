import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterOutlet } from '@angular/router';

import { APP_NAME } from '../../core/app.constants';

/** Layout of the public pages (login, register): centered card, no navigation. */
@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet, MatIconModule],
  template: `
    <div class="page">
      <header class="brand">
        <mat-icon aria-hidden="true">dashboard_customize</mat-icon>
        <span>{{ appName }}</span>
      </header>
      <main class="content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: `
    .page {
      min-height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 48px 16px;
      box-sizing: border-box;
      background: var(--mat-sys-surface-container-low);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 24px;
      font: var(--mat-sys-headline-small);
      color: var(--mat-sys-primary);
    }
    .content {
      width: 100%;
      max-width: 440px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthLayout {
  protected readonly appName = APP_NAME;
}
