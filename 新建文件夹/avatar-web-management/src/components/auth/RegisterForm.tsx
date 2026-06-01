'use client';

import { useState } from 'react';
import { Form, Input, Button, App } from 'antd';
import { MailOutlined, LockOutlined, UserOutlined } from '@ant-design/icons';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/stores/authStore';

export default function RegisterForm() {
  const t = useTranslations('auth.register');
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const registerAction = useAuthStore((s) => s.registerAction);

  const onFinish = async (values: { email: string; username: string; password: string }) => {
    setLoading(true);
    try {
      await registerAction(values.email, values.username, values.password);
      message.success(t('registerSuccess'));
      router.push('/login');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('registerFailed');
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
          <h2 className="text-lg font-semibold mb-6" style={{ color: 'var(--text-primary)' }}>{t('subtitle')}</h2>

          <Form layout="vertical" onFinish={onFinish} autoComplete="off">
            <Form.Item
              name="email"
              rules={[
                { required: true, message: t('emailRequired') || 'Please enter email' },
                { type: 'email', message: t('emailInvalid') || 'Invalid email' },
              ]}
            >
              <Input
                prefix={<MailOutlined style={{ color: 'var(--text-muted)' }} />}
                placeholder={t('emailPlaceholder')}
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="username"
              rules={[
                { required: true, message: t('usernameRequired') },
                { min: 2, message: t('usernameMinLength') },
                { max: 32, message: t('usernameMaxLength') },
                { pattern: /^[a-zA-Z0-9_一-龥]+$/, message: t('usernamePattern') },
              ]}
            >
              <Input
                prefix={<UserOutlined style={{ color: 'var(--text-muted)' }} />}
                placeholder={t('usernamePlaceholder')}
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[
                { required: true, message: t('passwordRequired') },
                { min: 8, message: t('passwordMinLength') },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: 'var(--text-muted)' }} />}
                placeholder={t('passwordPlaceholder')}
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="confirmPassword"
              dependencies={['password']}
              rules={[
                { required: true, message: t('confirmPassword') || 'Please confirm password' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error(t('passwordMismatch')));
                  },
                }),
              ]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: 'var(--text-muted)' }} />}
                placeholder={t('confirmPasswordPlaceholder')}
                size="large"
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
                {t('registerButton')}
              </Button>
            </Form.Item>

            <div className="text-center">
              <Link href="/login" className="text-sm transition-colors" style={{ color: 'var(--text-secondary)' }}>
                {t('hasAccount')}
              </Link>
            </div>
          </Form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--text-muted)' }}>
          {t('emailOnly')}
        </p>
      </div>
    </div>
  );
}
