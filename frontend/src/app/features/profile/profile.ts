import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatCardModule } from '@angular/material/card';

import { ApiError } from '../../core/models/api-error';
import { ROLE_LABELS, User } from '../../core/models/user';
import { ErrorState } from '../../shared/components/error-state/error-state';
import { LoadingState } from '../../shared/components/loading-state/loading-state';
import { PasswordForm } from './password-form/password-form';
import { ProfileInfoForm } from './profile-info-form/profile-info-form';
import { ProfileService } from './profile.service';
import { SkillsForm } from './skills-form/skills-form';

/** "My profile": account details, personal information, skills and password (all roles). */
@Component({
  selector: 'app-profile',
  imports: [
    DatePipe,
    MatCardModule,
    LoadingState,
    ErrorState,
    ProfileInfoForm,
    SkillsForm,
    PasswordForm,
  ],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Profile {
  private readonly profileService = inject(ProfileService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly user = signal<User | null>(null);
  protected readonly roleLabel = computed(() => {
    const user = this.user();
    return user ? ROLE_LABELS[user.role] : '';
  });

  constructor() {
    this.load();
  }

  /** Always reloads from the backend: the copy kept in the session may be outdated. */
  protected load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.profileService
      .load()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (user) => {
          this.user.set(user);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.errorMessage.set(
            error instanceof ApiError ? error.message : 'An unexpected error occurred.',
          );
          this.loading.set(false);
        },
      });
  }
}
