/** Claims of the backend access token. */
export interface JwtPayload {
  sub?: string;
  role?: string;
  iat?: number;
  exp?: number;
}

/**
 * Reads the payload of a JWT. The signature is NOT verified here: the frontend only uses
 * the expiry date to avoid sending an expired token; the backend verifies every token.
 */
export function decodeJwtPayload(token: string): JwtPayload | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const base64 = payload
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(payload.length / 4) * 4, '=');
    const decoded: unknown = JSON.parse(atob(base64));
    return decoded && typeof decoded === 'object' ? (decoded as JwtPayload) : null;
  } catch {
    return null;
  }
}

/** Expiry time in milliseconds since epoch, or null if the token has no readable `exp`. */
export function tokenExpiresAt(token: string): number | null {
  const exp = decodeJwtPayload(token)?.exp;
  return typeof exp === 'number' ? exp * 1000 : null;
}

export function isTokenExpired(token: string, now = Date.now()): boolean {
  const expiresAt = tokenExpiresAt(token);
  return expiresAt !== null && expiresAt <= now;
}
