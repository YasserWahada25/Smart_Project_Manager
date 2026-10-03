import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';

import { ConfirmService } from './confirm-dialog';

describe('ConfirmService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } }],
    });
  });

  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((c) => c.remove()));

  /** Lets the dialog render or close (zoneless change detection + overlay). */
  const settle = () => TestBed.inject(ApplicationRef).whenStable();

  async function open(destructive = false) {
    let result: boolean | undefined;
    TestBed.inject(ConfirmService)
      .confirm({
        title: 'Deactivate this account?',
        message: 'Youssef will be signed out.',
        confirmLabel: 'Deactivate',
        destructive,
      })
      .subscribe((confirmed) => (result = confirmed));
    await settle();
    const dialog = document.querySelector('mat-dialog-container') as HTMLElement;
    const button = (label: string) =>
      [...dialog.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)!;
    return { dialog, button, result: () => result };
  }

  it('shows the question and emits true when confirmed', async () => {
    const { dialog, button, result } = await open(true);

    expect(dialog.textContent).toContain('Deactivate this account?');
    expect(dialog.textContent).toContain('Youssef will be signed out.');
    expect(button('Deactivate').classList).toContain('destructive');

    button('Deactivate').click();
    await settle();

    expect(result()).toBe(true);
  });

  it('emits false when cancelled', async () => {
    const { button, result } = await open();

    button('Cancel').click();
    await settle();

    expect(result()).toBe(false);
  });
});
