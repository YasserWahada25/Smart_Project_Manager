import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatChipInputEvent, MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';

/**
 * List of short labels (technologies, required skills…) entered as chips: Enter, comma or
 * leaving the field adds the typed value; duplicates (ignoring case) are ignored. Validation
 * is done by the control's validators (see tagListValidator); their errors are shown here.
 */
@Component({
  selector: 'app-tag-input',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatChipsModule, MatIconModule],
  template: `
    <mat-form-field appearance="outline">
      <mat-label>{{ label() }}</mat-label>
      <mat-chip-grid #chipGrid [formControl]="control()" [attr.aria-label]="label()">
        @for (value of control().value; track value) {
          <mat-chip-row (removed)="remove(value)">
            {{ value }}
            <button matChipRemove type="button" [attr.aria-label]="'Remove ' + value">
              <mat-icon>cancel</mat-icon>
            </button>
          </mat-chip-row>
        }
        <input
          [placeholder]="placeholder()"
          [matChipInputFor]="chipGrid"
          [matChipInputSeparatorKeyCodes]="separatorKeys"
          [matChipInputAddOnBlur]="true"
          (matChipInputTokenEnd)="add($event)"
        />
      </mat-chip-grid>
      @if (hint()) {
        <mat-hint>{{ hint() }}</mat-hint>
      }
      @if (control().invalid) {
        <mat-error>{{ errorMessage() }}</mat-error>
      }
    </mat-form-field>
  `,
  styles: `
    mat-form-field {
      width: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TagInput {
  readonly control = input.required<FormControl<string[]>>();
  readonly label = input.required<string>();
  readonly placeholder = input('');
  readonly hint = input('');
  /** Singular noun used in the messages, e.g. "technology". */
  readonly itemName = input('item');
  readonly maxItems = input.required<number>();
  readonly maxLength = input.required<number>();

  protected readonly separatorKeys = [ENTER, COMMA] as const;

  protected add(event: MatChipInputEvent): void {
    const value = event.value.trim();
    const control = this.control();
    const known = control.value.some((item) => item.toLowerCase() === value.toLowerCase());
    if (value && !known) {
      control.setValue([...control.value, value]);
      control.markAsDirty();
    }
    event.chipInput.clear();
  }

  protected remove(value: string): void {
    const control = this.control();
    control.setValue(control.value.filter((item) => item !== value));
    control.markAsDirty();
  }

  protected errorMessage(): string {
    const errors = this.control().errors;
    if (!errors) return '';
    if (typeof errors['server'] === 'string') return errors['server'];
    if (errors['maxItems']) return `At most ${this.maxItems()} items`;
    if (errors['itemTooLong']) {
      return `Each ${this.itemName()} must be at most ${this.maxLength()} characters`;
    }
    if (errors['duplicateItem']) return `Duplicate ${this.itemName()}: ${errors['duplicateItem']}`;
    return 'Invalid value';
  }
}
