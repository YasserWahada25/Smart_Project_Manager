import { FormControl, FormGroup, Validators } from '@angular/forms';

import { ApiError } from '../../core/models/api-error';
import { applyServerErrors, firstErrorMessage } from './form-errors';
import { passwordPolicyValidator, sameAsValidator } from './password.validators';

describe('passwordPolicyValidator', () => {
  const check = (value: string) =>
    passwordPolicyValidator(new FormControl(value, { nonNullable: true }));

  it.each([
    ['', null],
    ['Secret123', null],
    ['abc1', { passwordMinLength: true }],
    [`a1${'x'.repeat(71)}`, { passwordMaxBytes: true }],
    [`a1${'€'.repeat(25)}`, { passwordMaxBytes: true }],
    ['12345678', { passwordLetter: true }],
    ['Password', { passwordDigit: true }],
  ])('%p → %p', (value, expected) => {
    expect(check(value)).toEqual(expected);
  });
});

describe('sameAsValidator', () => {
  it('flags a confirmation that differs from the password', () => {
    const form = new FormGroup({
      password: new FormControl('Secret123'),
      confirm: new FormControl('', sameAsValidator('password')),
    });

    form.controls.confirm.setValue('Secret12');
    expect(form.controls.confirm.errors).toEqual({ mismatch: true });

    form.controls.confirm.setValue('Secret123');
    expect(form.controls.confirm.errors).toBeNull();
  });
});

describe('form error helpers', () => {
  const form = () =>
    new FormGroup({
      name: new FormControl('', Validators.required),
      email: new FormControl('x@y.z'),
    });

  it('returns the first known validation message, or nothing for a valid control', () => {
    const f = form();
    expect(firstErrorMessage(f.controls.name, { required: 'Name is required' })).toBe(
      'Name is required',
    );
    expect(firstErrorMessage(f.controls.email, { required: 'x' })).toBe('');
  });

  it('applies backend messages to the matching controls and gives them priority', () => {
    const f = form();
    const error = new ApiError(400, 'BAD_REQUEST', 'Validation failed', [
      { field: 'email', message: 'Email is invalid' },
      { field: 'unknown', message: 'ignored' },
    ]);

    expect(applyServerErrors(f, error)).toBe(true);
    expect(f.controls.email.touched).toBe(true);
    expect(firstErrorMessage(f.controls.email, {})).toBe('Email is invalid');

    f.controls.email.setValue('new@example.com');
    expect(f.controls.email.errors).toBeNull();
  });

  it('returns false when no detail matches a control', () => {
    expect(applyServerErrors(form(), new ApiError(400, 'BAD_REQUEST', 'Validation failed'))).toBe(
      false,
    );
  });
});
