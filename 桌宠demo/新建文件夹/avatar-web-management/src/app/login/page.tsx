import { Suspense } from 'react';
import ChatLogin from '@/components/login/ChatLogin';

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-deep)' }}>
          <div className="w-10 h-10 rounded-full animate-spin" style={{ border: '3px solid var(--border-subtle)', borderTopColor: 'var(--accent)' }} />
        </div>
      }
    >
      <ChatLogin />
    </Suspense>
  );
}
