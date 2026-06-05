import { useAuthStore } from '@/stores/authStore';

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  });

  it('initial state is unauthenticated with loading', () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
  });

  it('setAuth sets user and token', () => {
    const user = { id: '1', email: 'test@test.com', username: 'tester', role: 'user', workspace_id: 'ws1', avatar_url: null, level: 1, exp: 0, activeTitle: null, unlockedTitles: [] as string[] };
    useAuthStore.getState().setAuth(user, 'token-123');
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.accessToken).toBe('token-123');
    expect(state.user?.email).toBe('test@test.com');
  });

  it('clearAuth resets state', () => {
    const user = { id: '1', email: 'test@test.com', username: 'tester', role: 'user', workspace_id: 'ws1', avatar_url: null, level: 1, exp: 0, activeTitle: null, unlockedTitles: [] as string[] };
    useAuthStore.getState().setAuth(user, 'token-123');
    useAuthStore.getState().clearAuth();
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.accessToken).toBeNull();
  });

  it('logout calls clearAuth and API', async () => {
    const user = { id: '1', email: 'test@test.com', username: 'tester', role: 'user', workspace_id: 'ws1', avatar_url: null, level: 1, exp: 0, activeTitle: null, unlockedTitles: [] as string[] };
    useAuthStore.getState().setAuth(user, 'token-123');

    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true }) });

    await useAuthStore.getState().logout();
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
  });
});
