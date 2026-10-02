import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

const PASSWORD_MIN_LENGTH = 8;
// bcrypt (backend) only uses the first 72 bytes of a password.
const PASSWORD_MAX_BYTES = 72;

/** Same password policy as the backend (validators/password.policy.js). Empty = handled by `required`. */
export function passwordPolicyValidator(control: AbstractControl<string>): ValidationErrors | null {
  const value = control.value;
  if (!value) return null;
  if (value.length < PASSWORD_MIN_LENGTH) return { passwordMinLength: true };
  if (new TextEncoder().encode(value).length > PASSWORD_MAX_BYTES)
    return { passwordMaxBytes: true };
  if (!/[A-Za-z]/.test(value)) return { passwordLetter: true };
  if (!/\d/.test(value)) return { passwordDigit: true };
  return null;
}

export const PASSWORD_ERROR_MESSAGES: Record<string, string> = {
  required: 'Password is required',
  passwordMinLength: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
  passwordMaxBytes: `Password must be at most ${PASSWORD_MAX_BYTES} bytes`,
  passwordLetter: 'Password must contain at least one letter',
  passwordDigit: 'Password must contain at least one digit',
};

/** The control must have the same value as its sibling `otherField` (e.g. password confirmation). */
export function sameAsValidator(otherField: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const other = control.parent?.get(otherField);
    if (!other || !control.value) return null;
    return control.value === other.value ? null : { mismatch: true };
  };
}
