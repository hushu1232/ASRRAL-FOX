// TODO: BEM-migrate
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from 'antd';
import { createLogger } from '@/lib/logger';

const log = createLogger('cookie-consent');
const STORAGE_KEY = 'astralfox_cookie_consent';

type ConsentChoice = 'accepted' | 'rejected' | null;

export function useCookieConsent() {
  const [choice, setChoice] = useState<ConsentChoice>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'accepted' || stored === 'rejected') {
        setChoice(stored);
      }
    } catch (err) {
      log.warn({ err }, 'Failed to read cookie consent');
    }
    setLoaded(true);
  }, []);

  const accept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'accepted');
      setChoice('accepted');
    } catch (err) {
      log.error({ err }, 'Failed to save consent');
    }
  };

  const reject = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'rejected');
      setChoice('rejected');
    } catch (err) {
      log.error({ err }, 'Failed to save consent');
    }
  };

  return { choice, loaded, accept, reject, show: loaded && choice === null };
}

export default function CookieConsent() {
  const { show, accept, reject } = useCookieConsent();

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gray-900/95 border-t border-gray-800 backdrop-blur-sm">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="text-gray-300 text-sm flex-1">
          We use essential cookies for authentication and language preferences.
          No tracking or advertising cookies.{' '}
          <Link href="/privacy" className="text-purple-400 hover:text-purple-300 underline">
            Privacy Policy
          </Link>
        </p>
        <div className="flex gap-2 shrink-0">
          <Button size="small" onClick={reject}>
            Reject Optional
          </Button>
          <Button size="small" type="primary" onClick={accept}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}