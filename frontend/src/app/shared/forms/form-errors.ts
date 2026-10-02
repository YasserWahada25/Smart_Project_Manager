import { AbstractControl, FormGroup } from '@angular/forms';

import { ApiError } from '../../core/models/api-error';

/**
 * Message to display under a field: a backend message first (`server` error), then the
 * first client validation error found in `messages`.
 */
export function firstErrorMessage(
  control: AbstractControl | null,
  messages: Record<string, string>,
): string {
  const errors = control?.errors;
  if (!errors) return '';
  if (typeof errors['server'] === 'string') return errors['server'];
  const key = Object.keys(errors).find((name) => name in messages);
  return key ? messages[key] : 'Invalid value';
}

/**
 * Shows the backend validation messages (ApiError.details) on the matching controls.
 * The `server` error disappears as soon as the user edits the field (validators re-run).
 * Returns true if at least one message was attached to a control.
 */
export function applyServerErrors(form: FormGroup, error: ApiError): boolean {
  let applied = false;
  for (const { field, message } of error.details) {
    const control = form.get(field);
    if (control) {
      control.setErrors({ ...control.errors, server: message });
      control.markAsTouched();
      applied = true;
    }
  }
  return applied;
}
