import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { identityColor, initials } from '../../colors';

export interface AvatarPerson {
  id?: string;
  firstName: string;
  lastName: string;
}

/**
 * Round avatar with the person's initials on their identity color (same person = same color
 * everywhere). Decorative by default (the name is written next to it); `labelled` gives it the name
 * as accessible label when it stands alone. Without a person: dashed "unassigned" circle.
 */
@Component({
  selector: 'app-avatar',
  template: `
    @if (person(); as current) {
      <span
        class="avatar"
        [class.small]="size() === 'small'"
        [class.large]="size() === 'large'"
        [style.background]="color()"
        [attr.role]="labelled() ? 'img' : null"
        [attr.aria-label]="labelled() ? name() : null"
        [attr.aria-hidden]="labelled() ? null : 'true'"
        [attr.title]="name()"
        [attr.data-initials]="letters()"
      ></span>
    } @else {
      <span
        class="avatar empty"
        [class.small]="size() === 'small'"
        [class.large]="size() === 'large'"
        [attr.role]="labelled() ? 'img' : null"
        [attr.aria-label]="labelled() ? 'Unassigned' : null"
        [attr.aria-hidden]="labelled() ? null : 'true'"
        title="Unassigned"
      ></span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
    }
    .avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      color: #fff;
      font: 600 10px/1 var(--mat-sys-body-medium-font, inherit);
      letter-spacing: 0.02em;
      user-select: none;
    }
    /* Drawn from an attribute: the initials are not part of the page text (the name is). */
    .avatar::before {
      content: attr(data-initials);
    }
    .small {
      width: 20px;
      height: 20px;
      font-size: 9px;
    }
    .large {
      width: 32px;
      height: 32px;
      font-size: 12px;
    }
    .empty {
      border: 1.5px dashed var(--mat-sys-outline);
      box-sizing: border-box;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Avatar {
  readonly person = input<AvatarPerson | null | undefined>(null);
  readonly size = input<'small' | 'medium' | 'large'>('medium');
  /** The avatar stands alone: it carries the name as accessible label. */
  readonly labelled = input(false);

  protected readonly name = computed(() => {
    const person = this.person();
    return person ? `${person.firstName} ${person.lastName}`.trim() : '';
  });
  protected readonly letters = computed(() => {
    const person = this.person();
    return initials(person?.firstName, person?.lastName);
  });
  protected readonly color = computed(() => {
    const person = this.person();
    return identityColor(person?.id || this.name());
  });
}
