'use client';

import { Tabs } from 'antd';
import { Card, Form, Input, Switch, Slider, Button } from 'antd';
import { App } from 'antd';
import { useTranslations } from 'next-intl';
import UsersTab from './UsersTab';
import ReviewsTab from './ReviewsTab';
import AuditLogsTab from './AuditLogsTab';
import StatsTab from './StatsTab';
import OAuthClientsTab from './OAuthClientsTab';
import MarketReviewTab from './MarketReviewTab';
import LevelConfigTab from './LevelConfigTab';

export default function AdminPage() {
  const t = useTranslations('admin');

  return (
    <App>
      <div>
        <h1 className="text-2xl font-bold text-white mb-6">{t('title')}</h1>
        <Tabs
          defaultActiveKey="users"
          className="[&_.ant-tabs-nav-list]:overflow-x-auto [&_.ant-tabs-nav-list]:pb-1"
          items={[
            { key: 'users', label: t('tabs.users'), children: <UsersTab /> },
            { key: 'reviews', label: t('tabs.reviews'), children: <ReviewsTab /> },
            { key: 'market', label: t('tabs.market'), children: <MarketReviewTab /> },
            { key: 'audit', label: t('tabs.audit'), children: <AuditLogsTab /> },
            { key: 'oauth', label: t('tabs.oauth'), children: <OAuthClientsTab /> },
            {
              key: 'config', label: t('tabs.config'),
            children: (
              <Card className="!border-purple-500/10 max-w-2xl">
                <Form layout="vertical">
                  <Form.Item label={t('config.maxUploadSize')}>
                    <Slider defaultValue={500} min={10} max={2000} step={10} />
                  </Form.Item>
                  <Form.Item label={t('config.autoReview')}><Switch defaultChecked /></Form.Item>
                  <Form.Item label={t('config.allowPublicRegister')}><Switch defaultChecked /></Form.Item>
                  <Form.Item label={t('config.cdnBaseUrl')}>
                    <Input defaultValue="https://cdn.avatar-system.example.com" />
                  </Form.Item>
                  <Button type="primary">{t('config.saveConfig')}</Button>
                </Form>
              </Card>
            ),
          },
          { key: 'levelConfig', label: t('tabs.levelConfig'), children: <LevelConfigTab /> },
          { key: 'stats', label: t('tabs.stats'), children: <StatsTab /> },
        ]}
      />
    </div>
    </App>
  );
}
