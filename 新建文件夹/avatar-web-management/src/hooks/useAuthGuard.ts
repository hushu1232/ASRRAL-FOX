'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

export function useAuthGuard() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  const requireAuth = (callback?: () => void): boolean => {
    if (!user) {
      router.push(`/login?callbackUrl=${encodeURIComponent(window.location.href)}`);
      return false;
    }
    callback?.();
    return true;
  };

  return { requireAuth, isLoggedIn: !!user };
}
