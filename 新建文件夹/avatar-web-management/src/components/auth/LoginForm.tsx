'use client';

import { useState } from 'react';
import { Form, Input, Button, Divider, App } from 'antd';
import { MailOutlined, LockOutlined, BankOutlined, EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/stores/authStore';

export default function LoginForm() {
  const t = useTranslations('auth.login');
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useAuthStore((s) => s.login);

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      await login(values.email, values.password);
      message.success(t('loginSuccess'));
      const returnUrl = searchParams.get('callbackUrl') || searchParams.get('returnUrl');
      router.replace(returnUrl || '/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('loginFailed');
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-deep)' }}>
      <div className="w-full max-w-[420px]">
        <div className="text-center mb-8">
          <Image src="/images/logo.svg" alt="星尘" width={56} height={56} className="mx-auto mb-3" priority unoptimized />
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{t('title')}</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('subtitle')}</p>
        </div>

        <div className="backdrop-blur-xl rounded-2xl p-8" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-card)' }}>
          <h2 className="text-lg font-semibold mb-6" style={{ color: 'var(--text-primary)' }}>{t('welcomeBack')}</h2>

          <Form layout="vertical" onFinish={onFinish} autoComplete="off">
            <Form.Item
              name="email"
              rules={[
                { required: true, message: t('emailRequired') },
                { type: 'email', message: t('emailInvalid') },
              ]}
            >
              <Input
                prefix={<MailOutlined style={{ color: 'var(--text-muted)' }} />}
                placeholder={t('emailPlaceholder')}
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: t('passwordRequired') }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: 'var(--text-muted)' }} />}
                placeholder={t('passwordPlaceholder')}
                size="large"
                iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
              />
            </Form.Item>

            <Form.Item className="mb-4">
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                size="large"
                className="h-11 font-semibold"
              >
                {t('loginButton')}
              </Button>
            </Form.Item>

            <div className="flex items-center justify-between text-sm">
              <Link href="/register" className="transition-colors" style={{ color: 'var(--text-secondary)' }}>
                {t('noAccount')}
              </Link>
              <Link href="/forgot-password" className="transition-colors" style={{ color: 'var(--text-muted)' }}>
                {t('forgotPassword')}
              </Link>
            </div>
          </Form>

          <Divider className="!my-5" style={{ borderColor: 'var(--border-subtle)' }}>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('or')}</span>
          </Divider>

          <Button
            icon={<BankOutlined />}
            block
            size="large"
            className="h-11 bg-transparent"
            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
            onClick={async () => {
              try {
                const res = await fetch('/api/auth/sso');
                const data = await res.json();
                if (data.success && data.data?.redirect_url) {
                  window.location.href = data.data.redirect_url;
                } else {
                  message.info(data.message || 'SSO not configured');
                }
              } catch {
                window.location.href = '/api/auth/sso';
              }
            }}
          >
            {t('ssoLogin')}
          </Button>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--text-muted)' }}>
          {t('footer')}
        </p>
      </div>
    </div>
  );
}
