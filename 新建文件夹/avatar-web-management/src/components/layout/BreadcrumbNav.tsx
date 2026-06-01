'use client';

import { Breadcrumb } from 'antd';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

const LABEL_MAP: Record<string, string> = {
  dashboard: 'layout.sidebar.dashboard',
  pet: 'layout.sidebar.pet',
  avatars: 'layout.sidebar.avatars',
  assets: 'layout.sidebar.assets',
  marketplace: 'layout.sidebar.marketplace',
  community: 'layout.sidebar.community',
  purchases: 'layout.sidebar.myPurchases',
  messages: 'layout.sidebar.messages',
  seller: 'layout.sidebar.sellerCenter',
  settings: 'layout.sidebar.settings',
  admin: 'layout.sidebar.admin',
  help: 'layout.sidebar.help',
  notifications: 'layout.sidebar.notifications',
};

export default function BreadcrumbNav() {
  const pathname = usePathname();
  const t = useTranslations();

  const segments = pathname.split('/').filter(Boolean);
  const items = segments.map((seg, i) => {
    const href = '/' + segments.slice(0, i + 1).join('/');
    const labelKey = LABEL_MAP[seg];
    return {
      title: labelKey ? t(labelKey) : seg.charAt(0).toUpperCase() + seg.slice(1),
      href: i < segments.length - 1 ? href : undefined,
    };
  });

  if (items.length <= 1) return null;

  return (
    <Breadcrumb
      items={items}
      style={{ fontSize: '0.8125rem' }}
    />
  );
}
