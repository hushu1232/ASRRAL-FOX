'use client';

import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, message, Progress, Descriptions, Tag } from 'antd';
import { CrownOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/stores/authStore';
import { apiGet, apiPut } from '@/lib/api-client';
import { LEVEL_EXP_TABLE, LEVEL_PREFIX, LEVEL_BENEFITS, MAX_LEVEL } from '@/lib/constants';

interface ProfileData {
  id: string; email: string; username: string; role: string; status: string;
  level: number; exp: number; activeTitle: string | null; unlockedTitles: string[];
  monthlyCloneUsed: number; totalLoginDays: number;
  levelPrefix: string; nextLevelExp: number | null; benefits: { voiceClonesPerMonth: number; assetCapacityMB: number; savedVoices: number; skinSlots: number; unlocks: string[] };
}

export default function ProfileTab() {
  const t = useTranslations('settings.profile');
  const user = useAuthStore(s => s.user);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    const res = await apiGet<ProfileData>('/api/settings/profile');
    if (res.success && res.data) setProfile(res.data);
  }

  const handleSave = async () => {
    const values = await form.validateFields();
    setSaving(true);
    const res = await apiPut('/api/settings/profile', values);
    setSaving(false);
    if (res.success) {
      message.success(t('saveSuccess'));
      fetchProfile();
    } else message.error(res.error || t('saveFailed'));
  };

  if (!profile) return null;

  const currentLevelExp = LEVEL_EXP_TABLE[profile.level];
  const isMaxLevel = profile.level >= MAX_LEVEL;
  const currentLevelRequired = currentLevelExp?.exp || 0;
  const expIntoLevel = isMaxLevel ? currentLevelRequired : profile.exp - (LEVEL_EXP_TABLE[profile.level]?.total || 0);
  const expPercent = isMaxLevel ? 100 : currentLevelRequired > 0
    ? Math.min(100, Math.round((expIntoLevel / currentLevelRequired) * 100))
    : 0;

  const benefits = profile.benefits || LEVEL_BENEFITS[profile.level];

  return (
    <div className="space-y-6 max-w-lg">
      <Card className="!border-purple-500/10" title={
        <span><CrownOutlined className="mr-2 text-yellow-400" />{t('levelCard')}</span>
      }>
        <div className="text-center mb-4">
          <div className="text-3xl font-bold text-white">
            Lv.{profile.level} <span className="text-purple-400">{profile.levelPrefix}</span>
          </div>
          {profile.activeTitle && (
            <Tag color="purple" className="mt-1">{profile.activeTitle}</Tag>
          )}
        </div>
        <Progress percent={expPercent} showInfo={false}
          strokeColor={{ from: '#7c3aed', to: '#a78bfa' }}
          trailColor="rgba(124,58,237,0.1)" />
        <div className="text-center text-gray-400 text-xs mt-1">
          {isMaxLevel
            ? t('maxLevel')
            : t('expToNext', { exp: (currentLevelRequired - expIntoLevel).toLocaleString() })
          }
          <span className="mx-2">|</span>
          {profile.exp.toLocaleString()} EXP
        </div>
      </Card>

      <Card className="!border-purple-500/10" title={t('benefits')}>
        <Descriptions size="small" column={1} colon={false}>
          <Descriptions.Item label={t('voiceClones')}>
            {t('cloneCount', { used: profile.monthlyCloneUsed, limit: benefits.voiceClonesPerMonth })}
          </Descriptions.Item>
          <Descriptions.Item label={t('assetCapacity')}>{benefits.assetCapacityMB} MB</Descriptions.Item>
          <Descriptions.Item label={t('savedVoices')}>{benefits.savedVoices}</Descriptions.Item>
          <Descriptions.Item label={t('skins')}>{benefits.skinSlots}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card className="!border-purple-500/10">
        <Form layout="vertical" form={form}
          initialValues={{ username: profile.username || '', email: profile.email || '' }}>
          <Form.Item label={t('username')} name="username">
            <Input placeholder={t('usernamePlaceholder')} />
          </Form.Item>
          <Form.Item label={t('email')} name="email">
            <Input disabled />
          </Form.Item>
          <Form.Item label={t('bio')} name="bio">
            <Input.TextArea rows={3} placeholder={t('bioPlaceholder')} />
          </Form.Item>
          <Button type="primary" onClick={handleSave} loading={saving}>{t('save')}</Button>
        </Form>
      </Card>
    </div>
  );
}
