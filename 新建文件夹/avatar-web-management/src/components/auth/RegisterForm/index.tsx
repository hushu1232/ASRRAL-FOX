'use client';

import { useState } from 'react';
import { Form, Input, Button, App } from 'antd';
import { MailOutlined, LockOutlined, UserOutlined } from '@ant-design/icons';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/stores/authStore';
import './style.scss';

export default function RegisterForm() {
  const t = useTranslations('auth.register');
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const register = useAuthStore((s) => s.register);

  const onFinish = async (values: { email: string; username: string; password: string }) => {
    setLoading(true);
    setError('');
    try {
      await register(values.email, values.username, values.password);
      message.success(t('registerSuccess'));
      router.replace('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('registerFailed');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-form">
      <div className="register-form__header">
        <Image src="/images/logo.svg" alt="星尘" width={56} height={56} className="register-form__logo" priority unoptimized />
        <h1 className="register-form__title">{t('title')}</h1>
        <p className="register-form__subtitle">{t('subtitle')}</p>
      </div>

      {error && <div className="register-form__error">{error}</div>}

      <Form layout="vertical" onFinish={onFinish} autoComplete="off">
        <Form.Item name="email" rules={[{ required: true, type: 'email' }, { type: 'email' }]} className="register-form__field">
          <Input prefix={<MailOutlined className="register-form__input-icon" />} placeholder={t('emailPlaceholder')} className="register-form__input" />
        </Form.Item>
        <Form.Item name="username" rules={[{ required: true }, { min: 2 }, { max: 32 }]} className="register-form__field">
          <Input prefix={<UserOutlined className="register-form__input-icon" />} placeholder={t('usernamePlaceholder')} className="register-form__input" />
        </Form.Item>
        <Form.Item name="password" rules={[{ required: true }, { min: 8 }]} className="register-form__field">
          <Input.Password prefix={<LockOutlined className="register-form__input-icon" />} placeholder={t('passwordPlaceholder')} className="register-form__input" />
        </Form.Item>
        <Form.Item
          name="confirmPassword"
          dependencies={['password']}
          rules={[{ required: true }, ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue('password') === value) return Promise.resolve();
              return Promise.reject(new Error(t('passwordMismatch')));
            },
          })]}
          className="register-form__field"
        >
          <Input.Password prefix={<LockOutlined className="register-form__input-icon" />} placeholder={t('confirmPasswordPlaceholder')} className="register-form__input" />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} className="register-form__submit">{t('registerButton')}</Button>
        </Form.Item>

        <p className="register-form__footer">
          {t('hasAccount')}{' '}
          <Link href="/login" className="register-form__link">{t('login')}</Link>
        </p>
      </Form>
    </div>
  );
}
