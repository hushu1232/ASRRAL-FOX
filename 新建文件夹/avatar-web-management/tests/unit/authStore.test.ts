import { useAuthStore } from '@/stores/authStore';

const baseUser = {
  level: 1,
  exp: 0,
  activeTitle: null as string | null,
  unlockedTitles: [] as string[],
};

describe('authStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isLoading: true,
      isAuthenticated: false,
    });
  });

  describe('initial state', () => {
    it('has default values', () => {
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(state.isLoading).toBe(true);
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('setAuth', () => {
    it('sets user, token, and auth flags', () => {
      const user = { id: '1', email: 'a@b.com', username: 'test', avatar_url: null, role: 'user', ...baseUser };
      useAuthStore.getState().setAuth(user, 'token-abc');
      const state = useAuthStore.getState();
      expect(state.user).toEqual(user);
      expect(state.accessToken).toBe('token-abc');
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('setAccessToken', () => {
    it('updates the access token', () => {
      useAuthStore.getState().setAccessToken('new-token');
      expect(useAuthStore.getState().accessToken).toBe('new-token');
    });
  });

  describe('setLoading', () => {
    it('updates loading state', () => {
      useAuthStore.getState().setLoading(false);
      expect(useAuthStore.getState().isLoading).toBe(false);
      useAuthStore.getState().setLoading(true);
      expect(useAuthStore.getState().isLoading).toBe(true);
    });
  });

  describe('clearAuth', () => {
    it('clears all auth state', () => {
      const user = { id: '1', email: 'a@b.com', username: 'test', avatar_url: null, role: 'user', ...baseUser };
      useAuthStore.getState().setAuth(user, 'token');
      useAuthStore.getState().clearAuth();
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('login', () => {
    it('sets auth state on successful login', async () => {
      const mockUser = { id: '1', email: 'a@b.com', username: 'test', avatar_url: null, role: 'user', ...baseUser };
      global.fetch = jest.fn().mockResolvedValueOnce({
        json: () => Promise.resolve({
          success: true,
          data: { user: mockUser, accessToken: 'token-login' },
        }),
      });

      await useAuthStore.getState().login('a@b.com', 'password');
      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.accessToken).toBe('token-login');
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    it('throws on login failure', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        json: () => Promise.resolve({ success: false, error: 'Invalid credentials' }),
      });

      await expect(useAuthStore.getState().login('a@b.com', 'wrong'))
        .rejects.toThrow('Invalid credentials');
    });

    it('throws with default message when response has no error', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        json: () => Promise.resolve({ success: false }),
      });

      await expect(useAuthStore.getState().login('a@b.com', 'wrong'))
        .rejects.toThrow('Login failed');
    });

    it('sends correct request body', async () => {
      const mockFetch = jest.fn().mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: { user: {}, accessToken: 't' } }),
      });
      global.fetch = mockFetch;

      await useAuthStore.getState().login('user@test.com', 'pass123');
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@test.com', password: 'pass123' }),
      });
    });
  });

  describe('registerAction', () => {
    it('resolves on successful registration', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true }),
      });

      await expect(useAuthStore.getState().registerAction('a@b.com', 'user', 'pass123'))
        .resolves.toBeUndefined();
    });

    it('throws on registration failure', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        json: () => Promise.resolve({ success: false, error: 'Email taken' }),
      });

      await expect(useAuthStore.getState().registerAction('a@b.com', 'user', 'pass'))
        .rejects.toThrow('Email taken');
    });
  });

  describe('logout', () => {
    it('clears auth state and calls logout endpoint', async () => {
      const user = { id: '1', email: 'a@b.com', username: 'test', avatar_url: null, role: 'user', ...baseUser };
      useAuthStore.getState().setAuth(user, 'token');
      const mockFetch = jest.fn().mockResolvedValueOnce({});
      global.fetch = mockFetch;

      await useAuthStore.getState().logout();
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });

    it('still clears auth state even if logout endpoint fails', async () => {
      const user = { id: '1', email: 'a@b.com', username: 'test', avatar_url: null, role: 'user', ...baseUser };
      useAuthStore.getState().setAuth(user, 'token');
      global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error'));

      // try/finally lets the error propagate after clearing state
      await expect(useAuthStore.getState().logout()).rejects.toThrow('Network error');
      // State is still cleared because finally runs before error propagates
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('refreshAuth', () => {
    it('sets auth on successful refresh', async () => {
      const mockUser = { id: '2', email: 'b@c.com', username: 'user2', avatar_url: null, role: 'user', ...baseUser };
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { user: mockUser, accessToken: 'refreshed-token' },
        }),
      });

      await useAuthStore.getState().refreshAuth();
      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.accessToken).toBe('refreshed-token');
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    it('clears auth on refresh failure', async () => {
      useAuthStore.setState({
        user: { id: 'x', email: 'x@x.com', username: 'x', avatar_url: null, role: 'user', ...baseUser },
        accessToken: 'old-token',
        isAuthenticated: true,
      });
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ success: false }),
      });

      await useAuthStore.getState().refreshAuth();
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
    });

    it('clears auth on network error during refresh', async () => {
      useAuthStore.setState({
        user: { id: 'x', email: 'x@x.com', username: 'x', avatar_url: null, role: 'user', ...baseUser },
        accessToken: 'old-token',
        isAuthenticated: true,
      });
      global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error'));

      await useAuthStore.getState().refreshAuth();
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });
});
