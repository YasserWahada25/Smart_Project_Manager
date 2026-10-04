import { Injectable, inject } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';

/** Opens the command palette (one at a time); the component is downloaded on first use. */
@Injectable({ providedIn: 'root' })
export class CommandPaletteService {
  private readonly dialog = inject(MatDialog);
  private ref?: MatDialogRef<unknown>;
  private opening = false;

  async open(query = ''): Promise<void> {
    if (this.ref || this.opening) return;
    this.opening = true;
    try {
      const { CommandPalette } = await import('./command-palette');
      this.ref = this.dialog.open(CommandPalette, {
        data: { query },
        width: '640px',
        maxWidth: 'calc(100vw - 32px)',
        position: { top: '12vh' },
        panelClass: 'command-palette-panel',
        autoFocus: 'input',
        ariaLabel: 'Command palette',
      });
      this.ref.afterClosed().subscribe(() => (this.ref = undefined));
    } finally {
      this.opening = false;
    }
  }
}
