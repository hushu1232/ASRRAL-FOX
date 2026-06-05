'use client';

import type { ReactNode } from 'react';
import { Breadcrumb, Tabs, Typography } from 'antd';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

// ─── Types ─────────────────────────────────────────────────────

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderTab {
  key: string;
  label: string;
  /** Optional badge count shown next to tab label */
  count?: number;
}

export interface PageHeaderProps {
  /** Page title (required) */
  title: string;
  /** Subtitle shown below the title */
  subtitle?: string;
  /** Breadcrumb trail — auto-generated from pathname if omitted */
  breadcrumbs?: BreadcrumbItem[];
  /** Action buttons rendered on the right side of the header */
  actions?: ReactNode;
  /** Tabs rendered below the title bar */
  tabs?: PageHeaderTab[];
  /** Default active tab key (used if no URL param present) */
  defaultTab?: string;
  /** URL param name for persisting tab state (default: 'tab') */
  tabParam?: string;
  /** Extra content rendered below tabs (e.g., stats row) */
  children?: ReactNode;
}

// ─── Path segment → i18n key mapping ──────────────────────────

const SEGMENT_LABEL_MAP: Record<string, string> = {
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
  rigging: 'layout.sidebar.rigging',
  'api-docs': 'layout.sidebar.apiDocs',
};

// ─── Component ─────────────────────────────────────────────────

export default function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  actions,
  tabs,
  defaultTab,
  tabParam = 'tab',
  children,
}: PageHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations();

  // Auto-generate breadcrumbs from pathname if not provided
  const resolvedBreadcrumbs = breadcrumbs ?? generateBreadcrumbs(pathname, t);
  const showBreadcrumbs = resolvedBreadcrumbs.length > 1;

  // Tab state from URL for persistence
  const activeTab = tabs
    ? searchParams.get(tabParam) || defaultTab || tabs[0]?.key
    : undefined;

  const handleTabChange = (key: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(tabParam, key);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const tabItems = tabs?.map((tab) => ({
    key: tab.key,
    label: (
      <span>
        {tab.label}
        {tab.count !== undefined && (
          <span
            className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs"
            style={{ background: 'var(--bg-card-hover)', color: 'var(--text-muted)' }}
          >
            {tab.count}
          </span>
        )}
      </span>
    ),
  }));

  return (
    <div className="mb-6">
      {/* Breadcrumb row */}
      {showBreadcrumbs && (
        <Breadcrumb
          className="mb-2"
          items={resolvedBreadcrumbs.map((item, i) => ({
            title:
              i < resolvedBreadcrumbs.length - 1 && item.href ? (
                <a
                  href={item.href}
                  className="hover:underline"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {item.label}
                </a>
              ) : (
                <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
              ),
          }))}
        />
      )}

      {/* Title + Actions row */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
        <div className="min-w-0">
          <h1
            className="text-2xl font-bold m-0"
            style={{ color: 'var(--text-primary)' }}
          >
            {title}
          </h1>
          {subtitle && (
            <Typography.Paragraph
              className="mt-1 mb-0 text-sm"
              style={{ color: 'var(--text-secondary)' }}
            >
              {subtitle}
            </Typography.Paragraph>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
        )}
      </div>

      {/* Tabs */}
      {tabItems && activeTab && (
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          items={tabItems}
          className="[&_.ant-tabs-nav]:!mb-0 [&_.ant-tabs-nav::before]:!border-[var(--border-subtle)]"
        />
      )}

      {/* Extra content (stats row, etc.) */}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────

function generateBreadcrumbs(
  pathname: string,
  t: ReturnType<typeof useTranslations>,
): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length <= 1) return [];

  return segments.map((seg, i) => {
    const href = '/' + segments.slice(0, i + 1).join('/');
    const labelKey = SEGMENT_LABEL_MAP[seg];
    const label = labelKey ? t(labelKey) : seg.charAt(0).toUpperCase() + seg.slice(1);
    return { label, href };
  });
}
