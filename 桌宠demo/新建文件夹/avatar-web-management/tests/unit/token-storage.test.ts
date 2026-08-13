/** @jest-environment jsdom */

import {
  clearStoredAuth,
  getStoredAccessToken,
  getStoredAuth,
  getStoredUser,
  setStoredAuth,
} from '@/lib/auth/tokenStorage';

const auth = {
  user: {
    id: 'user-1',
    email: 'user@example.com',
    username: 'user',
    avatar_url: null,
    role: 'user',
    level: 1,
    exp: 0,
    activeTitle: null,
    unlockedTitles: [],
  },
  accessToken: 'access-token',
};

describe('token storage', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips auth and exposes token/user helpers', () => {
    expect(getStoredAuth()).toBeNull();
    setStoredAuth(auth);

    expect(getStoredAuth()).toEqual(auth);
    expect(getStoredAccessToken()).toBe(auth.accessToken);
    expect(getStoredUser()).toEqual(auth.user);

    clearStoredAuth();
    expect(getStoredAuth()).toBeNull();
  });

  it('removes malformed persisted data', () => {
    localStorage.setItem('astralfox_auth', JSON.stringify({ accessToken: '', user: {} }));
    expect(getStoredAuth()).toBeNull();
    expect(localStorage.getItem('astralfox_auth')).toBeNull();

    localStorage.setItem('astralfox_auth', '{broken');
    expect(getStoredAuth()).toBeNull();
  });
});
