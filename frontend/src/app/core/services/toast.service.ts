import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

/** Short feedback messages (Material snack bar), styled in styles.scss. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly snackBar = inject(MatSnackBar);

  success(message: string): void {
    this.open(message, 'toast-success', 4000);
  }

  info(message: string): void {
    this.open(message, 'toast-info', 4000);
  }

  error(message: string): void {
    this.open(message, 'toast-error', 6000);
  }

  private open(message: string, panelClass: string, duration: number): void {
    this.snackBar.open(message, 'Close', { duration, panelClass: [panelClass] });
  }
}
