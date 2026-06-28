'use client';

import { Tabs, Card, Switch, Button, Divider } from 'antd';
import { LinkOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import PageHeader from '@/components/layout/PageHeader';
import ProfileTab from './ProfileTab';
import SecurityTab from './SecurityTab';
import ApiKeysTab from './ApiKeysTab';
import TitleTab from './TitleTab';

export default function SettingsPage() {
  const t = useTranslations('settings');
  const tn = useTranslations('settings.notifications');
  const te = useTranslations('settings.enterprise');

  return (
    <div>
      <PageHeader title={t('title')} />
      <Tabs
        defaultActiveKey="profile"
        items={[
          { key: 'profile', label: t('tabs.profile'), children: <ProfileTab /> },
          { key: 'titles', label: t('tabs.titles'), children: <TitleTab /> },
          { key: 'security', label: t('tabs.security'), children: <SecurityTab /> },
          { key: 'apikeys', label: 'API Keys', children: <ApiKeysTab /> },
          {
            key: 'notifications', label: t('tabs.notifications'),
            children: (
              <Card className="!border-purple-500/10 max-w-lg">
                <h3 className="text-white font-medium mb-4">{tn('title')}</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div><span className="text-white">{tn('emailNotification')}</span><p className="text-gray-500 text-xs">{tn('emailDesc')}</p></div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div><span className="text-white">{tn('inAppNotification')}</span><p className="text-gray-500 text-xs">{tn('inAppDesc')}</p></div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div><span className="text-white">{tn('marketingEmail')}</span><p className="text-gray-500 text-xs">{tn('marketingDesc')}</p></div>
                    <Switch />
                  </div>
                </div>
              </Card>
            ),
          },
          {
            key: 'enterprise', label: t('tabs.enterprise'),
            children: (
              <Card className="!border-purple-500/10 max-w-lg">
                <h3 className="text-white font-medium mb-2">{te('title')}</h3>
                <p className="text-gray-400 text-sm mb-4">
                  {te('description')}
                </p>
                <Button icon={<LinkOutlined />}>{te('bindButton')}</Button>
                <Divider />
                <p className="text-gray-500 text-xs">
                  {te('notice')}
                </p>
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}
