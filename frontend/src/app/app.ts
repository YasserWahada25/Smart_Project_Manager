import { ChangeDetectionStrategy, Component, afterNextRender, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ToastService } from './core/services/toast.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  constructor() {
    // Once the first page is displayed, download the toast code in the background: a
    // "cannot reach the server" message must still be displayable if the network drops later.
    const toast = inject(ToastService);
    afterNextRender(() => toast.preload());
  }
}
