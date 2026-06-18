'use client';

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import PageHeader from '@/components/layout/PageHeader';
import UsersTab from './UsersTab';
import ReviewsTab from './ReviewsTab';
import AuditLogsTab from './AuditLogsTab';
import StatsTab from './StatsTab';
import OAuthClientsTab from './OAuthClientsTab';
import MarketReviewTab from './MarketReviewTab';
import LevelConfigTab from './LevelConfigTab';

export default function AdminPage() {
  const t = useTranslations('admin');

  const tabPanes: Record<string, React.ReactNode> = {
    users: <UsersTab />,
    reviews: <ReviewsTab />,
    market: <MarketReviewTab />,
    audit: <AuditLogsTab />,
    oauth: <OAuthClientsTab />,
    config: null, // handled inline
    levelConfig: <LevelConfigTab />,
    stats: <StatsTab />,
  };

  return (
    <div>
      <PageHeader
        title={t('title')}
        tabs={[
          { key: 'users', label: t('tabs.users') },
          { key: 'reviews', label: t('tabs.reviews') },
          { key: 'market', label: t('tabs.market') },
          { key: 'audit', label: t('tabs.audit') },
          { key: 'oauth', label: t('tabs.oauth') },
          { key: 'config', label: t('tabs.config') },
          { key: 'levelConfig', label: t('tabs.levelConfig') },
          { key: 'stats', label: t('tabs.stats') },
        ]}
        defaultTab="users"
      />
      {/* Render active tab content — tabs are URL-persisted via PageHeader */}
      <TabContentRenderer panes={tabPanes} />
    </div>
  );
}

/** Renders the active tab based on URL search param 'tab' */
function TabContentRenderer({ panes }: { panes: Record<string, React.ReactNode> }) {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') || 'users';
  return <>{panes[activeTab] ?? panes.users}</>;
}
