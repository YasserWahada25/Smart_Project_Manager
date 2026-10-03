import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Whole number (empty is allowed: combine with `required` if needed). */
export function integerValidator(control: AbstractControl): ValidationErrors | null {
  const value: unknown = control.value;
  if (value === null || value === undefined || value === '') return null;
  return Number.isInteger(value) ? null : { integer: true };
}

/**
 * List of short labels (technologies, skills…) with the backend rules: at most `maxItems`,
 * each at most `maxLength` characters, unique ignoring case.
 */
export function tagListValidator(maxItems: number, maxLength: number): ValidatorFn {
  return (control: AbstractControl<string[] | null>): ValidationErrors | null => {
    const values = control.value ?? [];
    if (values.length > maxItems) return { maxItems: maxItems };
    const tooLong = values.find((value) => value.length > maxLength);
    if (tooLong !== undefined) return { itemTooLong: tooLong };
    const seen = new Set<string>();
    for (const value of values) {
      const key = value.toLowerCase();
      if (seen.has(key)) return { duplicateItem: value };
      seen.add(key);
    }
    return null;
  };
}

/**
 * Date (`YYYY-MM-DD`) that must not be before the date of the sibling control `otherField`
 * (e.g. deadline ≥ start date). Empty values are allowed.
 */
export function notBeforeValidator(otherField: string): ValidatorFn {
  return (control: AbstractControl<string | null>): ValidationErrors | null => {
    const other: unknown = control.parent?.get(otherField)?.value;
    if (!control.value || typeof other !== 'string' || !other) return null;
    // ISO dates (YYYY-MM-DD) compare correctly as strings.
    return control.value < other ? { notBefore: true } : null;
  };
}
