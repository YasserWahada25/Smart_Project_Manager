import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Role, User } from '../models/user';
import { ToastService } from '../services/toast.service';
import { AuthResponse, LoginRequest, RegisterRequest } from './auth.models';
import { isTokenExpired, tokenExpiresAt } from './jwt';
import { StoredSession, TokenStorage } from './token-storage';

// setTimeout delays are 32-bit integers (~24.8 days).
const MAX_TIMER_DELAY = 2_147_483_647;

/**
 * Holds the authenticated session (JWT + user) in signals and keeps it in storage.
 * The session is restored synchronously at startup (no flash of the login page) and the
 * user is re-validated in the background with GET /auth/me (refreshOnStartup).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(TokenStorage);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly url = `${environment.apiUrl}/auth`;

  private readonly session = signal<StoredSession | null>(null);
  private expiryTimer: ReturnType<typeof setTimeout> | undefined;

  readonly currentUser = computed(() => this.session()?.user ?? null);
  readonly token = computed(() => this.session()?.token ?? null);
  readonly isAuthenticated = computed(() => this.session() !== null);

  constructor() {
    const stored = this.storage.load();
    if (stored && !isTokenExpired(stored.token)) {
      this.setSession(stored, { persist: false });
    } else {
      this.storage.clear();
    }
  }

  login(credentials: LoginRequest): Observable<User> {
    return this.http
      .post<AuthResponse>(`${this.url}/login`, credentials)
      .pipe(map((response) => this.start(response)));
  }

  /** Creates the account and opens a session (the backend returns a token). */
  register(data: RegisterRequest): Observable<User> {
    return this.http
      .post<AuthResponse>(`${this.url}/register`, data)
      .pipe(map((response) => this.start(response)));
  }

  /** Reloads the current user from the backend (role or profile may have changed). */
  refreshCurrentUser(): Observable<User> {
    return this.http.get<{ user: User }>(`${this.url}/me`).pipe(
      map(({ user }) => {
        this.updateCurrentUser(user);
        return user;
      }),
    );
  }

  /** Keeps the session copy of the user in sync (e.g. after a profile update). */
  updateCurrentUser(user: User): void {
    const token = this.token();
    if (token) this.setSession({ token, user });
  }

  /**
   * Switches the session to a new token (returned after a password change: every token
   * issued before the change is now rejected by the backend).
   */
  replaceSession(response: AuthResponse): User {
    return this.start(response);
  }

  /** Called once at startup: re-validates a restored session without blocking the UI. */
  refreshOnStartup(): void {
    if (!this.isAuthenticated()) return;
    // A 401 is handled by authInterceptor (session expired); other errors keep the session.
    this.refreshCurrentUser().subscribe({ error: () => undefined });
  }

  hasRole(...roles: Role[]): boolean {
    const user = this.currentUser();
    return user !== null && roles.includes(user.role);
  }

  logout(): void {
    clearTimeout(this.expiryTimer);
    this.session.set(null);
    this.storage.clear();
  }

  /** Ends a session the backend no longer accepts and sends the user to the login page. */
  expireSession(): void {
    if (!this.isAuthenticated()) return;
    this.logout();
    this.toast.info('Your session has expired. Please log in again.');
    const returnUrl = this.router.url;
    void this.router.navigate(['/login'], {
      queryParams: returnUrl && returnUrl !== '/' ? { returnUrl } : {},
    });
  }

  private start({ token, user }: AuthResponse): User {
    this.setSession({ token, user });
    return user;
  }

  private setSession(session: StoredSession, { persist = true } = {}): void {
    this.session.set(session);
    if (persist) this.storage.save(session.token, session.user);
    this.scheduleExpiry(session.token);
  }

  private scheduleExpiry(token: string): void {
    clearTimeout(this.expiryTimer);
    const expiresAt = tokenExpiresAt(token);
    if (expiresAt === null) return;
    const delay = Math.max(expiresAt - Date.now(), 0);
    if (delay < MAX_TIMER_DELAY) {
      this.expiryTimer = setTimeout(() => this.expireSession(), delay);
    }
  }
}
