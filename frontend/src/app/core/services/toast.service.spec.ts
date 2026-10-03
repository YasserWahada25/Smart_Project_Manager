import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';

import { ToastService } from './toast.service';

describe('ToastService', () => {
  let open: ReturnType<typeof vi.fn>;
  let toast: ToastService;

  beforeEach(() => {
    open = vi.fn();
    TestBed.configureTestingModule({ providers: [{ provide: MatSnackBar, useValue: { open } }] });
    toast = TestBed.inject(ToastService);
  });

  it.each([
    ['success', 'toast-success', 4000],
    ['info', 'toast-info', 4000],
    ['error', 'toast-error', 6000],
  ] as const)('%s() opens a styled snack bar', async (method, panelClass, duration) => {
    toast[method]('Saved');

    // The snack bar is loaded on demand (dynamic import), then opened.
    await vi.waitFor(() =>
      expect(open).toHaveBeenCalledWith('Saved', 'Close', { duration, panelClass: [panelClass] }),
    );
  });

  it('shows the messages in the order they were requested', async () => {
    toast.preload();
    toast.info('First');
    toast.error('Second');

    await vi.waitFor(() => expect(open).toHaveBeenCalledTimes(2));
    expect(open.mock.calls.map(([message]) => message)).toEqual(['First', 'Second']);
  });
});
