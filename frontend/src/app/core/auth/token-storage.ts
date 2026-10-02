import { Injectable } from '@angular/core';

import { User } from '../models/user';

const TOKEN_KEY = 'spm.auth.token';
const USER_KEY = 'spm.auth.user';

export interface StoredSession {
  token: string;
  user: User;
}

/**
 * Persists the session in localStorage so it survives a page reload. Storage can be
 * unavailable (private mode, quota): the session then only lives in memory.
 */
@Injectable({ providedIn: 'root' })
export class TokenStorage {
  load(): StoredSession | null {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const user = localStorage.getItem(USER_KEY);
      if (!token || !user) return null;
      return { token, user: JSON.parse(user) as User };
    } catch {
      return null;
    }
  }

  save(token: string, user: User): void {
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
      // Storage unavailable: the session is kept in memory only.
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch {
      // Nothing to clear.
    }
  }
}
