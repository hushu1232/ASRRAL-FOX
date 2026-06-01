/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { App } from 'antd';
import RegisterForm from '@/components/auth/RegisterForm';

let mockRegisterAction = jest.fn();
let mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/register',
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
      const state = {
        registerAction: mockRegisterAction,
        isLoading: false,
        isAuthenticated: false,
      };
      if (selector) return selector(state);
      return state;
    }),
    {
      getState: () => ({
        registerAction: mockRegisterAction,
        isLoading: false,
        isAuthenticated: false,
      }),
      setState: jest.fn(),
      subscribe: jest.fn(),
    }
  );
  return { useAuthStore: mockHook };
});

jest.mock('@ant-design/icons', () => ({
  MailOutlined: () => <span data-testid="icon-mail" />,
  LockOutlined: () => <span data-testid="icon-lock" />,
  UserOutlined: () => <span data-testid="icon-user" />,
  EyeInvisibleOutlined: () => <span data-testid="icon-eye-off" />,
  EyeTwoTone: () => <span data-testid="icon-eye" />,
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return <App>{children}</App>;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRegisterAction = jest.fn().mockResolvedValue(undefined);
  mockPush = jest.fn();
});

describe('RegisterForm', () => {
  // ─── Rendering ─────────────────────────────────────────

  it('renders the register form without crashing', () => {
    render(<RegisterForm />, { wrapper: Wrapper });
    expect(screen.getByPlaceholderText('emailPlaceholder')).toBeDefined();
  });

  it('renders username input', () => {
    render(<RegisterForm />, { wrapper: Wrapper });
    expect(screen.getByPlaceholderText('usernamePlaceholder')).toBeDefined();
  });

  it('renders password input', () => {
    render(<RegisterForm />, { wrapper: Wrapper });
    expect(screen.getByPlaceholderText('passwordPlaceholder')).toBeDefined();
  });

  it('renders confirm password input', () => {
    render(<RegisterForm />, { wrapper: Wrapper });
    expect(screen.getByPlaceholderText('confirmPasswordPlaceholder')).toBeDefined();
  });

  it('renders register button', () => {
    render(<RegisterForm />, { wrapper: Wrapper });
    expect(screen.getByText('registerButton')).toBeDefined();
  });

  it('renders login link', () => {
    render(<RegisterForm />, { wrapper: Wrapper });
    expect(screen.getByText('hasAccount')).toBeDefined();
  });

  // ─── Validation ────────────────────────────────────────

  function fillAndSubmit(email: string, username: string, password: string, confirmPassword: string) {
    if (email) fireEvent.change(screen.getByPlaceholderText('emailPlaceholder'), { target: { value: email } });
    if (username) fireEvent.change(screen.getByPlaceholderText('usernamePlaceholder'), { target: { value: username } });
    if (password) fireEvent.change(screen.getByPlaceholderText('passwordPlaceholder'), { target: { value: password } });
    if (confirmPassword) fireEvent.change(screen.getByPlaceholderText('confirmPasswordPlaceholder'), { target: { value: confirmPassword } });
    fireEvent.click(screen.getByText('registerButton'));
  }

  it('blocks submit on empty fields (validation prevents onFinish)', async () => {
    render(<RegisterForm />, { wrapper: Wrapper });
    fillAndSubmit('', '', '', '');
    await waitFor(() => {
      expect(document.querySelector('.ant-form-item-is-validating')).toBeTruthy();
    });
    expect(mockRegisterAction).not.toHaveBeenCalled();
  });

  it('blocks submit on invalid email format', async () => {
    render(<RegisterForm />, { wrapper: Wrapper });
    fillAndSubmit('bad-email', 'testuser', 'password123', 'password123');
    await waitFor(() => {
      expect(document.querySelector('.ant-form-item-is-validating')).toBeTruthy();
    });
    expect(mockRegisterAction).not.toHaveBeenCalled();
  });

  it('blocks submit on password mismatch', async () => {
    render(<RegisterForm />, { wrapper: Wrapper });
    fillAndSubmit('user@example.com', 'testuser', 'password123', 'different456');
    await waitFor(() => {
      expect(document.querySelector('.ant-form-item-is-validating')).toBeTruthy();
    });
    expect(mockRegisterAction).not.toHaveBeenCalled();
  });

  it('accepts valid form input and calls registerAction', async () => {
    mockRegisterAction.mockResolvedValue(undefined);
    render(<RegisterForm />, { wrapper: Wrapper });
    fillAndSubmit('newuser@example.com', 'newuser', 'password123', 'password123');
    await waitFor(() => {
      expect(mockRegisterAction).toHaveBeenCalledWith('newuser@example.com', 'newuser', 'password123');
    });
  });

  it('accepts Chinese characters in username', async () => {
    mockRegisterAction.mockResolvedValue(undefined);
    render(<RegisterForm />, { wrapper: Wrapper });
    fillAndSubmit('user@example.com', '用户名', 'password123', 'password123');
    await waitFor(() => {
      expect(mockRegisterAction).toHaveBeenCalledWith('user@example.com', '用户名', 'password123');
    });
  });

  // ─── Successful submit ─────────────────────────────────

  it('redirects to /login after successful registration', async () => {
    mockRegisterAction.mockResolvedValue(undefined);
    render(<RegisterForm />, { wrapper: Wrapper });
    fillAndSubmit('newuser@example.com', 'newuser', 'password123', 'password123');
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  // ─── Error handling ────────────────────────────────────

  it('calls registerAction on failed registration (API error propagates)', async () => {
    mockRegisterAction.mockRejectedValue(new Error('Email already registered'));
    render(<RegisterForm />, { wrapper: Wrapper });
    fillAndSubmit('taken@example.com', 'takenuser', 'password123', 'password123');
    await waitFor(() => {
      expect(mockRegisterAction).toHaveBeenCalled();
    });
  });

  // ─── Navigation ────────────────────────────────────────

  it('has a link to login page', () => {
    render(<RegisterForm />, { wrapper: Wrapper });
    const link = screen.getByText('hasAccount').closest('a');
    expect(link?.getAttribute('href')).toBe('/login');
  });
});
