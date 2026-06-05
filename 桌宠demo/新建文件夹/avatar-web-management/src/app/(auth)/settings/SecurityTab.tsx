'use client';

import { useEffect, useState } from 'react';
import { Card, Form, Input, Button, List, Divider, Spin, Tag, Space, App } from 'antd';
import { HistoryOutlined, KeyOutlined, CheckOutlined, StopOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { apiGet, apiPut, apiPost, apiDelete } from '@/lib/api-client';

interface LoginHistoryItem {
  ip: string;
  location: string;
  device: string;
  time: string;
}

export default function SecurityTab() {
  const t = useTranslations('settings.security');
  const { message } = App.useApp();
  const [passwordForm] = Form.useForm();
  const [changing, setChanging] = useState(false);
  const [loginHistory, setLoginHistory] = useState<LoginHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [twoFALoading, setTwoFALoading] = useState(true);
  const [twoFASecret, setTwoFASecret] = useState('');
  const [twoFAUri, setTwoFAUri] = useState('');
  const [twoFASetup, setTwoFASetup] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [disableCode, setDisableCode] = useState('');
  const [disabling, setDisabling] = useState(false);

  useEffect(() => {
    // Fetch login history
    setHistoryLoading(true);
    apiGet<LoginHistoryItem[]>('/api/settings/login-history').then(res => {
      if (res.success) setLoginHistory(res.data);
    }).finally(() => setHistoryLoading(false));

    // Check 2FA status
    setTwoFALoading(true);
    apiGet<{ enabled: boolean }>('/api/settings/2fa').then(res => {
      if (res.success) setTwoFAEnabled(res.data.enabled);
    }).finally(() => setTwoFALoading(false));
  }, []);

  const handleChangePassword = async () => {
    const values = await passwordForm.validateFields();
    if (values.newPassword !== values.confirmPassword) {
      message.error(t('passwordMismatch'));
      return;
    }
    setChanging(true);
    const res = await apiPut('/api/settings/profile', {
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
    });
    setChanging(false);
    if (res.success) {
      message.success(t('passwordChanged'));
      passwordForm.resetFields();
    } else { message.error(res.error || t('updateFailed')); }
  };

  const handleEnable2FA = async () => {
    const res = await apiPost<{ secret: string; uri: string }>('/api/settings/2fa');
    if (res.success) {
      setTwoFASecret(res.data.secret);
      setTwoFAUri(res.data.uri);
      setTwoFASetup(true);
    } else {
      message.error(res.error || t('generateFailed'));
    }
  };

  const handleVerify2FA = async () => {
    if (verifyCode.length !== 6) return;
    setVerifying(true);
    const res = await apiPut('/api/settings/2fa', { token: verifyCode });
    setVerifying(false);
    if (res.success) {
      message.success(t('2faEnabled'));
      setTwoFAEnabled(true);
      setTwoFASetup(false);
      setTwoFASecret('');
      setTwoFAUri('');
      setVerifyCode('');
    } else {
      message.error(res.error || t('verificationFailed'));
    }
  };

  const handleDisable2FA = async () => {
    setDisabling(true);
    const { useAuthStore } = await import('@/stores/authStore');
    const token = useAuthStore.getState().accessToken;
    const token_res = await fetch('/api/settings/2fa', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ token: disableCode }),
    });
    const data = await token_res.json();
    setDisabling(false);
    if (data.success) {
      message.success(t('2faDisabled'));
      setTwoFAEnabled(false);
      setDisableCode('');
    } else {
      message.error(data.error || t('operationFailed'));
    }
  };

  return (
    <Card className="!border-purple-500/10 max-w-lg">
      <h3 className="text-white font-medium mb-4">{t('changePassword')}</h3>
      <Form layout="vertical" form={passwordForm}>
        <Form.Item label={t('currentPassword')} name="currentPassword" rules={[{ required: true }]}>
          <Input.Password />
        </Form.Item>
        <Form.Item label={t('newPassword')} name="newPassword" rules={[{ required: true, min: 8 }]}>
          <Input.Password />
        </Form.Item>
        <Form.Item label={t('confirmNewPassword')} name="confirmPassword" rules={[{ required: true }]}>
          <Input.Password />
        </Form.Item>
        <Button type="primary" onClick={handleChangePassword} loading={changing}>{t('updatePassword')}</Button>
      </Form>
      <Divider />
      <h3 className="text-white font-medium mb-2">{t('twoFactor')}</h3>
      {twoFALoading ? <Spin size="small" /> : twoFAEnabled ? (
        <div>
          <Tag color="green">{t('twoFactorEnabled')}</Tag>
          <p className="text-gray-400 text-sm my-3">{t('twoFactorEnabledDesc')}</p>
          <Space>
            <Input placeholder={t('disablePlaceholder')} value={disableCode} onChange={e => setDisableCode(e.target.value)} maxLength={6} style={{ width: 140 }} />
            <Button danger icon={<StopOutlined />} onClick={handleDisable2FA} loading={disabling}>{t('disable2FA')}</Button>
          </Space>
        </div>
      ) : twoFASetup ? (
        <div>
          <p className="text-gray-400 text-sm mb-3">{t('setupHint')}</p>
          <div className="bg-[#1a1a3e] border border-purple-500/20 rounded-lg p-4 mb-3">
            <code className="text-purple-300 text-lg font-mono break-all">{twoFASecret}</code>
          </div>
          <p className="text-gray-500 text-xs mb-3">{t('manualHint')}</p>
          <Space>
            <Input placeholder={t('verifyPlaceholder')} value={verifyCode} onChange={e => setVerifyCode(e.target.value)} maxLength={6} style={{ width: 160 }} />
            <Button type="primary" icon={<CheckOutlined />} onClick={handleVerify2FA} loading={verifying} disabled={verifyCode.length !== 6}>{t('verifyAndEnable')}</Button>
            <Button onClick={() => { setTwoFASetup(false); setTwoFASecret(''); }}>{t('cancel')}</Button>
          </Space>
        </div>
      ) : (
        <div>
          <p className="text-gray-400 text-sm mb-3">{t('enableDesc')}</p>
          <Button icon={<KeyOutlined />} onClick={handleEnable2FA}>{t('enable2FA')}</Button>
        </div>
      )}
      <Divider />
      <h3 className="text-white font-medium mb-4">{t('loginHistory')}</h3>
      {historyLoading ? <Spin /> : loginHistory.length === 0 ? (
        <p className="text-gray-500 text-sm">{t('noLoginHistory')}</p>
      ) : (
        <List dataSource={loginHistory} renderItem={item => (
          <List.Item>
            <div className="flex items-center gap-2 text-sm">
              <HistoryOutlined className="text-gray-500" />
              <span className="text-gray-300">{item.location}</span>
              <span className="text-gray-500">· {item.device}</span>
              <span className="text-gray-500 ml-auto">{item.time}</span>
            </div>
          </List.Item>
        )} />
      )}
    </Card>
  );
}
