/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { App } from 'antd';
import LoginForm from '@/components/auth/LoginForm';

let mockLogin = jest.fn();
let mockPush = jest.fn();
let mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/login',
}));

jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

jest.mock('@/stores/authStore', () => {
  const mockHook = Object.assign(
    jest.fn((selector?: (s: unknown) => unknown) => {
      const state = { login: mockLogin, isLoading: false, isAuthenticated: false };
      if (selector) return selector(state);
      return state;
    }),
    {
      getState: () => ({ login: mockLogin, isLoading: false, isAuthenticated: false }),
      setState: jest.fn(),
      subscribe: jest.fn(),
    }
  );
  return { useAuthStore: mockHook };
});

jest.mock('@ant-design/icons', () => ({
  MailOutlined: () => <span data-testid="icon-mail" />,
  LockOutlined: () => <span data-testid="icon-lock" />,
  BankOutlined: () => <span data-testid="icon-bank" />,
  EyeInvisibleOutlined: () => <span data-testid="icon-eye-off" />,
  EyeTwoTone: () => <span data-testid="icon-eye" />,
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return <App>{children}</App>;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLogin = jest.fn().mockResolvedValue(undefined);
  mockPush = jest.fn();
  mockReplace = jest.fn();
});

describe('LoginForm', () => {
  // ─── Rendering ─────────────────────────────────────────

  it('renders the login form without crashing', () => {
    render(<LoginForm />, { wrapper: Wrapper });
    expect(screen.getByPlaceholderText('emailPlaceholder')).toBeDefined();
  });

  it('renders SSO login button', () => {
    render(<LoginForm />, { wrapper: Wrapper });
    expect(screen.getByText('ssoLogin')).toBeDefined();
  });

  it('renders login button', () => {
    render(<LoginForm />, { wrapper: Wrapper });
    expect(screen.getByText('loginButton')).toBeDefined();
  });

  it('renders register link', () => {
    render(<LoginForm />, { wrapper: Wrapper });
    expect(screen.getByText('noAccount')).toBeDefined();
  });

  it('renders forgot password link', () => {
    render(<LoginForm />, { wrapper: Wrapper });
    expect(screen.getByText('forgotPassword')).toBeDefined();
  });

  it('has email and password inputs', () => {
    render(<LoginForm />, { wrapper: Wrapper });
    expect(screen.getByPlaceholderText('emailPlaceholder')).toBeDefined();
    expect(screen.getByPlaceholderText('passwordPlaceholder')).toBeDefined();
  });

  // ─── Validation ────────────────────────────────────────

  function fillAndSubmit(email: string, password: string) {
    if (email) fireEvent.change(screen.getByPlaceholderText('emailPlaceholder'), { target: { value: email } });
    if (password) fireEvent.change(screen.getByPlaceholderText('passwordPlaceholder'), { target: { value: password } });
    fireEvent.click(screen.getByText('loginButton'));
  }

  it('blocks submit on empty fields (validation prevents onFinish)', async () => {
    render(<LoginForm />, { wrapper: Wrapper });
    fillAndSubmit('', '');
    await waitFor(() => {
      expect(document.querySelector('.ant-form-item-is-validating')).toBeTruthy();
    });
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('blocks submit on invalid email format', async () => {
    render(<LoginForm />, { wrapper: Wrapper });
    fillAndSubmit('not-an-email', 'password123');
    await waitFor(() => {
      expect(document.querySelector('.ant-form-item-is-validating')).toBeTruthy();
    });
    expect(mockLogin).not.toHaveBeenCalled();
  });

  // ─── Successful submit ─────────────────────────────────

  it('calls login with email and password on valid submit', async () => {
    mockLogin.mockResolvedValue(undefined);
    render(<LoginForm />, { wrapper: Wrapper });
    fillAndSubmit('demo@example.com', 'demo1234');
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('demo@example.com', 'demo1234');
    });
  });

  it('redirects to /dashboard after successful login', async () => {
    mockLogin.mockResolvedValue(undefined);
    render(<LoginForm />, { wrapper: Wrapper });
    fillAndSubmit('demo@example.com', 'demo1234');
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/dashboard');
    });
  });

  // ─── Error handling ────────────────────────────────────

  it('calls login on failed login (API error propagates)', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid credentials'));
    render(<LoginForm />, { wrapper: Wrapper });
    fillAndSubmit('bad@user.com', 'wrongpass');
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalled();
    });
  });

  // ─── Navigation links ──────────────────────────────────

  it('has a link to register page', () => {
    render(<LoginForm />, { wrapper: Wrapper });
    const link = screen.getByText('noAccount').closest('a');
    expect(link?.getAttribute('href')).toBe('/register');
  });

  it('has a link to forgot-password page', () => {
    render(<LoginForm />, { wrapper: Wrapper });
    const link = screen.getByText('forgotPassword').closest('a');
    expect(link?.getAttribute('href')).toBe('/forgot-password');
  });

  // ─── SSO button ────────────────────────────────────────

  it('has SSO login button', () => {
    render(<LoginForm />, { wrapper: Wrapper });
    const ssoBtn = screen.getByText('ssoLogin');
    expect(ssoBtn).toBeDefined();
  });
});
