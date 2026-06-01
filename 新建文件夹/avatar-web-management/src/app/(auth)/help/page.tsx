'use client';

export const dynamic = 'force-static';

import { Card, Collapse, Table, Steps, Tag, Button } from 'antd';
import { CaretRightOutlined, CopyOutlined } from '@ant-design/icons';
import { useTranslations, useMessages } from 'next-intl';

interface ShortcutItem { key: string; action: string; }
interface FaqItem { q: string; a: string; }
interface UpdateItem { version: string; date: string; changes: string[]; }

export default function HelpPage() {
  const t = useTranslations('help');
  const messages = useMessages();
  const helpMsgs = (messages as Record<string, unknown>).help as Record<string, unknown>;
  const shortcuts = (helpMsgs?.shortcuts as ShortcutItem[]) || [];
  const faqs = (helpMsgs?.faqs as FaqItem[]) || [];
  const updates = (helpMsgs?.updates as UpdateItem[]) || [];

  // Numbered step arrays (indexed 0-4)
  const steps = [
    { title: t('steps.step1Title'), description: t('steps.step1Desc') },
    { title: t('steps.step2Title'), description: t('steps.step2Desc') },
    { title: t('steps.step3Title'), description: t('steps.step3Desc') },
    { title: t('steps.step4Title'), description: t('steps.step4Desc') },
    { title: t('steps.step5Title'), description: t('steps.step5Desc') },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">{t('title')}</h1>

      <div className="space-y-6">
        <Card className="!border-purple-500/10" title={t('gettingStarted')}>
          <Steps
            current={-1}
            items={steps}
          />
        </Card>

        <Card className="!border-purple-500/10" title={t('shortcuts')}>
          <Table
            dataSource={shortcuts}
            rowKey="key"
            pagination={false}
            columns={[
              {
                title: t('shortcutKey'), dataIndex: 'key', key: 'key',
                render: (k: string) => <Tag className="font-mono bg-gray-800 border-gray-700 text-gray-200 px-2 py-0.5">{k}</Tag>,
              },
              { title: t('shortcutAction'), dataIndex: 'action', key: 'action' },
            ]}
          />
        </Card>

        <Card className="!border-purple-500/10" title={t('faq')}>
          <Collapse
            accordion
            expandIcon={({ isActive }) => <CaretRightOutlined rotate={isActive ? 90 : 0} />}
            items={faqs.map((faq, i) => ({
              key: String(i),
              label: <span className="text-white">{faq.q}</span>,
              children: <p className="text-gray-300">{faq.a}</p>,
            }))}
          />
        </Card>

        <Card className="!border-purple-500/10" title={t('changelog')}>
          {updates.map((u) => (
            <div key={u.version} className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Tag color="purple">{u.version}</Tag>
                <span className="text-gray-400 text-xs">{u.date}</span>
              </div>
              <ul className="list-disc list-inside text-gray-300 text-sm space-y-1">
                {u.changes.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
