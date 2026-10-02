// Test helpers (excluded from the application build, see tsconfig.app.json).
import { computed, signal } from '@angular/core';

import { AuthService } from '../core/auth/auth.service';
import { Role, User } from '../core/models/user';

export function testUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    firstName: 'Sara',
    lastName: 'Manager',
    email: 'sara@example.com',
    role: 'PROJECT_MANAGER',
    isActive: true,
    jobTitle: '',
    bio: '',
    skills: [],
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

function base64Url(value: object): string {
  return btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/** Unsigned JWT-like token whose payload expires in `expiresInSeconds` (negative = expired). */
export function testToken(expiresInSeconds = 3600, claims: object = {}): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: 'u1',
    role: 'PROJECT_MANAGER',
    iat: now,
    exp: now + expiresInSeconds,
    ...claims,
  };
  return `${base64Url({ alg: 'HS256', typ: 'JWT' })}.${base64Url(payload)}.signature`;
}

/** AuthService replacement with a fixed session; methods are vi.fn() spies. */
export function fakeAuthService(user: User | null) {
  const session = signal(user);
  return {
    currentUser: session.asReadonly(),
    token: computed(() => (session() ? 'test-token' : null)),
    isAuthenticated: computed(() => session() !== null),
    hasRole: (...roles: Role[]) => {
      const current = session();
      return current !== null && roles.includes(current.role);
    },
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(() => session.set(null)),
    expireSession: vi.fn(),
    refreshOnStartup: vi.fn(),
    refreshCurrentUser: vi.fn(),
  } satisfies Partial<Record<keyof AuthService, unknown>>;
}

export type FakeAuthService = ReturnType<typeof fakeAuthService>;
