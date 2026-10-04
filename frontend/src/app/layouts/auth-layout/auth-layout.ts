import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { APP_NAME } from '../../core/app.constants';

/**
 * Layout of the public pages (login, register): the Smart Manager logo above a centered card. The
 * name is written as text (not the full logo image) so that it stays readable in the dark theme.
 */
@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet],
  template: `
    <div class="page">
      <header class="brand">
        <img src="logo-mark.png" alt="" width="72" height="72" />
        <span class="name" [attr.aria-label]="appName"
          ><span class="first">Smart</span> <span class="second">Manager</span></span
        >
        <span class="tagline">Plan · Organize · Collaborate · Achieve</span>
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
      background: var(--spm-canvas);
    }
    .brand {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      margin-bottom: 28px;
    }
    .name {
      font: 700 28px/1.2 var(--mat-sys-headline-small-font, inherit);
      letter-spacing: -0.02em;
    }
    .first {
      color: var(--mat-sys-on-surface);
    }
    .second {
      color: var(--mat-sys-primary);
    }
    .tagline {
      font: var(--mat-sys-label-small);
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--spm-muted);
    }
    .content {
      width: 100%;
      max-width: 420px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthLayout {
  protected readonly appName = APP_NAME;
}
