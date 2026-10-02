import { User } from '../models/user';

export interface LoginRequest {
  email: string;
  password: string;
}

/** Public registration: ADMIN accounts cannot be self-created (backend rule). */
export type SelfRegistrationRole = 'DEVELOPER' | 'PROJECT_MANAGER';

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: SelfRegistrationRole;
}

/** Response of POST /auth/login and POST /auth/register. */
export interface AuthResponse {
  token: string;
  tokenType: 'Bearer';
  expiresIn: string;
  user: User;
}
