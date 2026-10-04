import { ChangeDetectionStrategy, Component, afterNextRender, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ThemeService } from './core/services/theme.service';
import { ToastService } from './core/services/toast.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  constructor() {
    // Light / dark / system theme, applied from the first page.
    inject(ThemeService);
    // Once the first page is displayed, download the toast code in the background: a
    // "cannot reach the server" message must still be displayable if the network drops later.
    const toast = inject(ToastService);
    afterNextRender(() => toast.preload());
  }
}
