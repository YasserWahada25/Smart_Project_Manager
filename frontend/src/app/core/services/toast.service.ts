import { Injectable, Injector, inject } from '@angular/core';
import type { MatSnackBar } from '@angular/material/snack-bar';

/**
 * Short feedback messages (Material snack bar), styled in styles.scss.
 *
 * The snack bar (and the CDK overlay it relies on) is loaded on the first message instead of
 * at startup: no toast is needed to display the first page, so it stays out of the initial
 * bundle.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly injector = inject(Injector);
  private snackBar?: Promise<MatSnackBar>;

  success(message: string): void {
    this.open(message, 'toast-success', 4000);
  }

  info(message: string): void {
    this.open(message, 'toast-info', 4000);
  }

  error(message: string): void {
    this.open(message, 'toast-error', 6000);
  }

  /** Downloads the snack bar code ahead of the first message (called after the first render). */
  preload(): void {
    void this.load();
  }

  private open(message: string, panelClass: string, duration: number): void {
    void this.load().then((snackBar) =>
      snackBar.open(message, 'Close', { duration, panelClass: [panelClass] }),
    );
  }

  private load(): Promise<MatSnackBar> {
    this.snackBar ??= import('@angular/material/snack-bar').then(({ MatSnackBar }) =>
      this.injector.get(MatSnackBar),
    );
    return this.snackBar;
  }
}
