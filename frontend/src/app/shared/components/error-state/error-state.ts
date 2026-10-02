import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/** Error message with an optional "Try again" button (shown when `retryable`). */
@Component({
  selector: 'app-error-state',
  imports: [MatButtonModule, MatIconModule],
  template: `
    <div class="state" role="alert">
      <mat-icon class="icon" aria-hidden="true">error</mat-icon>
      <p class="message">{{ message() }}</p>
      @if (retryable()) {
        <button mat-stroked-button type="button" (click)="retry.emit()">
          <mat-icon>refresh</mat-icon>
          Try again
        </button>
      }
    </div>
  `,
  styles: `
    .state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 32px 16px;
      text-align: center;
    }
    .icon {
      color: var(--mat-sys-error);
      font-size: 40px;
      width: 40px;
      height: 40px;
    }
    .message {
      margin: 0;
      max-width: 480px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorState {
  readonly message = input.required<string>();
  readonly retryable = input(true);
  readonly retry = output<void>();
}
