'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';

interface LoginResult {
  success: boolean;
  message?: string;
}

export function useLogin() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loginStore = useAuthStore((s) => s.login);

  const login = async (email: string, password: string): Promise<LoginResult> => {
    setIsLoading(true);
    setError(null);

    try {
      await loginStore(email, password);
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '登录失败';
      // Map known error patterns to friendly messages
      if (msg.includes('401') || msg.includes('Invalid') || msg.includes('invalid') || msg.includes('wrong')) {
        setError('auth');
      } else if (msg.includes('network') || msg.includes('fetch') || msg.includes('NetworkError')) {
        setError('network');
      } else {
        setError('server');
      }
      return { success: false, message: msg };
    } finally {
      setIsLoading(false);
    }
  };

  return { login, isLoading, error, clearError: () => setError(null) };
}
