'use client';

import { useState } from 'react';
import { Form, Input, Button, Divider, App } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/stores/authStore';
import './style.scss';

export default function LoginForm() {
  const t = useTranslations('auth.login');
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useAuthStore((s) => s.login);

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true);
    setError('');
    try {
      await login(values.email, values.password);
      message.success(t('loginSuccess'));
      const returnUrl = searchParams.get('callbackUrl') || searchParams.get('returnUrl');
      router.replace(returnUrl || '/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('loginFailed');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-form">
      <div className="login-form__header">
        <Image src="/images/logo.svg" alt="星尘" width={56} height={56} className="login-form__logo" priority unoptimized />
        <h1 className="login-form__title">{t('title')}</h1>
        <p className="login-form__subtitle">{t('subtitle')}</p>
      </div>

      {error && <div className="login-form__error">{error}</div>}

      <Form onFinish={onFinish} layout="vertical" size="large">
        <Form.Item name="email" rules={[{ required: true, type: 'email', message: t('emailRequired') }]} className="login-form__field">
          <Input prefix={<MailOutlined className="login-form__input-icon" />} placeholder={t('emailPlaceholder')} className="login-form__input" />
        </Form.Item>

        <Form.Item name="password" rules={[{ required: true, message: t('passwordRequired') }]} className="login-form__field">
          <Input.Password prefix={<LockOutlined className="login-form__input-icon" />} placeholder={t('passwordPlaceholder')} className="login-form__input" />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} className="login-form__submit">{t('submit')}</Button>
        </Form.Item>
      </Form>

      <div className="login-form__forgot">
        <Link href="/forgot-password" className="login-form__link">{t('forgotPassword')}</Link>
      </div>

      <Divider plain className="login-form__divider">{t('orContinueWith')}</Divider>

      <Button className="login-form__sso-btn" onClick={() => router.push('/api/auth/sso')}>{t('sso')}</Button>

      <p className="login-form__footer">
        {t('noAccount')}{' '}
        <Link href="/register" className="login-form__link">{t('register')}</Link>
      </p>
    </div>
  );
}
