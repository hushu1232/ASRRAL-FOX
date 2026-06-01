'use client';

import { useState, useEffect, Suspense } from 'react';
import { Card, Button, Spin, App } from 'antd';
import { SafetyOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/stores/authStore';

function ConsentContent() {
  const t = useTranslations('oauth.consent');
  const searchParams = useSearchParams();
  const router = useRouter();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  const clientId = searchParams.get('client_id');
  const redirectUri = searchParams.get('redirect_uri');
  const scope = searchParams.get('scope') || 'openid';
  const state = searchParams.get('state');
  const codeChallenge = searchParams.get('code_challenge');
  const codeChallengeMethod = searchParams.get('code_challenge_method');
  const { user, isAuthenticated } = useAuthStore();

  const scopes = scope.split(' ').filter(Boolean);
  const scopeLabels: Record<string, string> = {
    openid: t('openid'),
    profile: t('profile'),
    email: t('email'),
  };

  useEffect(() => {
    if (!isAuthenticated) {
      const current = new URL(window.location.href);
      const returnUrl = encodeURIComponent(current.pathname + current.search);
      router.push(`/login?redirect=${returnUrl}`);
    }
  }, [isAuthenticated, router]);

  const handleApprove = async () => {
    setLoading(true);
    try {
      const token = useAuthStore.getState().accessToken;
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/api/oauth/authorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          client_id: clientId,
          redirect_uri: redirectUri,
          scope,
          state,
          code_challenge: codeChallenge,
          code_challenge_method: codeChallengeMethod,
        }),
      });

      const data = await res.json();
      if (data.redirect_url) {
        window.location.href = data.redirect_url;
      } else {
        message.error(data.error || t('authFailed'));
      }
    } catch {
      message.error(t('requestFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeny = () => {
    if (redirectUri) {
      const url = new URL(redirectUri);
      url.searchParams.set('error', 'access_denied');
      url.searchParams.set('error_description', 'User denied the request');
      if (state) url.searchParams.set('state', state);
      window.location.href = url.toString();
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090F] p-4">
      <Card
        className="!border-purple-500/10 max-w-md w-full"
        styles={{ body: { background: '#0d0d1a' } }}
      >
        <div className="text-center mb-6">
          <SafetyOutlined className="text-4xl text-purple-400 mb-3" />
          <h1 className="text-xl font-bold text-white">{t('title')}</h1>
          <p className="text-gray-400 text-sm mt-1">
            {t('description', { clientId: clientId || t('unknownApp') })}
          </p>
        </div>

        <div className="bg-[#12122A] rounded-lg p-4 mb-4 border border-purple-500/10">
          <p className="text-gray-300 text-sm mb-3">{t('permissions')}</p>
          <ul className="space-y-2">
            {scopes.map((s) => (
              <li key={s} className="flex items-center gap-2 text-sm text-gray-400">
                <CheckCircleOutlined className="text-green-500" />
                <span>{scopeLabels[s] || s}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-[#12122A] rounded-lg p-3 mb-6 border border-purple-500/10">
          <p className="text-gray-500 text-xs">
            {t('authorizeAs', { identity: user?.username || user?.email || t('unknownUser') })}
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            block
            size="large"
            onClick={handleDeny}
            className="border-gray-600 text-gray-400"
          >
            {t('deny')}
          </Button>
          <Button
            type="primary"
            block
            size="large"
            loading={loading}
            onClick={handleApprove}
            className="bg-gradient-to-r from-purple-600 to-blue-600 border-0"
          >
            {t('authorize')}
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default function ConsentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#09090F]"><Spin size="large" /></div>}>
      <App>
        <ConsentContent />
      </App>
    </Suspense>
  );
}
