import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink, MatButtonModule, MatIconModule],
  template: `
    <section class="not-found">
      <mat-icon class="icon" aria-hidden="true">travel_explore</mat-icon>
      <h1>Page not found</h1>
      <p>The page you are looking for does not exist or has been moved.</p>
      <a mat-flat-button routerLink="/">Back to home</a>
    </section>
  `,
  styles: `
    .not-found {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 8px;
      padding: 48px 16px;
    }
    .icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: var(--mat-sys-primary);
    }
    h1 {
      font: var(--mat-sys-headline-medium);
      margin: 8px 0 0;
    }
    p {
      margin: 0 0 16px;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFound {}
