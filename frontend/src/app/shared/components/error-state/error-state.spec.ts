import { TestBed } from '@angular/core/testing';

import { ErrorState } from './error-state';

describe('ErrorState', () => {
  function render(retryable = true) {
    const fixture = TestBed.createComponent(ErrorState);
    fixture.componentRef.setInput('message', 'Something went wrong');
    fixture.componentRef.setInput('retryable', retryable);
    fixture.detectChanges();
    return fixture;
  }

  it('shows the message as an alert', () => {
    const element: HTMLElement = render().nativeElement;

    expect(element.querySelector('[role="alert"]')?.textContent).toContain('Something went wrong');
  });

  it('emits retry when "Try again" is clicked', () => {
    const fixture = render();
    const retry = vi.fn();
    fixture.componentInstance.retry.subscribe(retry);

    (fixture.nativeElement as HTMLElement).querySelector('button')?.click();

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('hides the button when the error is not retryable', () => {
    expect((render(false).nativeElement as HTMLElement).querySelector('button')).toBeNull();
  });
});
