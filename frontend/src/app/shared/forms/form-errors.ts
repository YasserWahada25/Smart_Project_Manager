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
 * Array paths use the backend notation (`skills[1].level` → control `skills.1.level`).
 * The `server` error disappears as soon as the user edits the field (validators re-run).
 * Returns true if at least one message was attached to a control.
 */
export function applyServerErrors(form: FormGroup, error: ApiError): boolean {
  let applied = false;
  for (const { field, message } of error.details) {
    const control = form.get(field.replace(/\[(\d+)\]/g, '.$1'));
    if (control) {
      control.setErrors({ ...control.errors, server: message });
      control.markAsTouched();
      applied = true;
    }
  }
  return applied;
}

/**
 * Error of a form submission: backend validation messages go on their fields (returns null);
 * any other error returns the message to display above the form.
 */
export function formSubmitError(form: FormGroup, error: unknown): string | null {
  if (!(error instanceof ApiError)) return 'An unexpected error occurred.';
  if (error.status === 400 && applyServerErrors(form, error)) return null;
  return error.message;
}
