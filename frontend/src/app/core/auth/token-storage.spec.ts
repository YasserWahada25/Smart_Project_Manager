import { testUser } from '../../testing/test-data';
import { TokenStorage } from './token-storage';

describe('TokenStorage', () => {
  const storage = new TokenStorage();

  beforeEach(() => localStorage.clear());

  it('saves and loads a session', () => {
    storage.save('token-1', testUser());

    expect(storage.load()).toEqual({ token: 'token-1', user: testUser() });
  });

  it('returns null when nothing (or only part of the session) is stored', () => {
    expect(storage.load()).toBeNull();

    localStorage.setItem('spm.auth.token', 'token-1');
    expect(storage.load()).toBeNull();
  });

  it('returns null for a corrupted user entry', () => {
    localStorage.setItem('spm.auth.token', 'token-1');
    localStorage.setItem('spm.auth.user', '{not json');

    expect(storage.load()).toBeNull();
  });

  it('clears the session', () => {
    storage.save('token-1', testUser());

    storage.clear();

    expect(localStorage.length).toBe(0);
  });
});
