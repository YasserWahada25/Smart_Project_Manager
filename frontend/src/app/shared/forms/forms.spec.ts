import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';

import { ApiError } from '../../core/models/api-error';
import { applyServerErrors, firstErrorMessage, formSubmitError } from './form-errors';
import { passwordPolicyValidator, sameAsValidator } from './password.validators';
import { integerValidator, notBeforeValidator, tagListValidator } from './validators';

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

  it('maps backend array paths (skills[1].level) to the controls of a FormArray', () => {
    const f = new FormGroup({
      skills: new FormArray([
        new FormGroup({ level: new FormControl('EXPERT') }),
        new FormGroup({ level: new FormControl('GURU') }),
      ]),
    });

    applyServerErrors(
      f,
      new ApiError(400, 'BAD_REQUEST', 'Validation failed', [
        { field: 'skills[1].level', message: 'Skill level is invalid' },
      ]),
    );

    expect(f.get('skills.1.level')?.errors).toEqual({ server: 'Skill level is invalid' });
    expect(f.get('skills.0.level')?.errors).toBeNull();
  });

  it('formSubmitError: field messages go on the fields, other errors are returned', () => {
    const f = form();
    const fieldError = new ApiError(400, 'BAD_REQUEST', 'Validation failed', [
      { field: 'email', message: 'Email is invalid' },
    ]);

    expect(formSubmitError(f, fieldError)).toBeNull();
    expect(f.controls.email.errors).toEqual({ server: 'Email is invalid' });
    expect(formSubmitError(f, new ApiError(409, 'CONFLICT', 'Already exists'))).toBe(
      'Already exists',
    );
    expect(formSubmitError(f, new Error('boom'))).toBe('An unexpected error occurred.');
  });
});

describe('tagListValidator', () => {
  const check = (values: string[]) => tagListValidator(3, 10)(new FormControl(values));

  it.each([
    [[], null],
    [['Angular', 'Node.js'], null],
    [['a', 'b', 'c', 'd'], { maxItems: 3 }],
    [['Angular', 'x'.repeat(11)], { itemTooLong: 'x'.repeat(11) }],
    [['Angular', 'angular'], { duplicateItem: 'angular' }],
  ])('%p → %p', (values, expected) => {
    expect(check(values)).toEqual(expected);
  });
});

describe('notBeforeValidator', () => {
  it('requires the deadline to be on or after the start date (empty allowed)', () => {
    const form = new FormGroup({
      startDate: new FormControl('2026-10-10'),
      deadline: new FormControl('', notBeforeValidator('startDate')),
    });
    const deadline = form.controls.deadline;

    expect(deadline.errors).toBeNull();
    deadline.setValue('2026-10-09');
    expect(deadline.errors).toEqual({ notBefore: true });
    deadline.setValue('2026-10-10');
    expect(deadline.errors).toBeNull();
  });
});

describe('integerValidator', () => {
  it.each([
    [null, null],
    ['', null],
    [0, null],
    [12, null],
    [2.5, { integer: true }],
  ])('%p → %p', (value, expected) => {
    expect(integerValidator(new FormControl(value))).toEqual(expected);
  });
});
