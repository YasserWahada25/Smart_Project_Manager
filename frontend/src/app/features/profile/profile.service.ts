import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthResponse } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { Skill, User } from '../../core/models/user';

/** Editable fields of PATCH /profile (email, role and status cannot be changed there). */
export interface ProfileUpdate {
  firstName: string;
  lastName: string;
  jobTitle: string;
  bio: string;
}

export interface PasswordChange {
  currentPassword: string;
  newPassword: string;
}

/**
 * Own profile of the signed-in user (`/profile` endpoints). Every successful call also
 * refreshes the user kept in the session, so the toolbar and the other pages stay in sync.
 */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly url = `${environment.apiUrl}/profile`;

  load(): Observable<User> {
    return this.http.get<{ user: User }>(this.url).pipe(map(({ user }) => this.keep(user)));
  }

  update(changes: ProfileUpdate): Observable<User> {
    return this.http
      .patch<{ user: User }>(this.url, changes)
      .pipe(map(({ user }) => this.keep(user)));
  }

  /** Replaces the whole skill list. */
  updateSkills(skills: Skill[]): Observable<User> {
    return this.http
      .put<{ user: User }>(`${this.url}/skills`, { skills })
      .pipe(map(({ user }) => this.keep(user)));
  }

  /**
   * The backend rejects every token issued before the change (all devices) and returns a
   * new one: the session switches to it, so the current tab stays signed in.
   */
  changePassword(change: PasswordChange): Observable<User> {
    return this.http
      .patch<AuthResponse>(`${this.url}/password`, change)
      .pipe(map((response) => this.auth.replaceSession(response)));
  }

  private keep(user: User): User {
    this.auth.updateCurrentUser(user);
    return user;
  }
}
