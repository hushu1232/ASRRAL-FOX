'use client';

import { useState } from 'react';
import { Card, Table, InputNumber, Button, message, Descriptions, Tag, Spin, Tabs } from 'antd';
import { useTranslations } from 'next-intl';
import { apiPut } from '@/lib/api-client';
import { useApiGet } from '@/lib/use-api';
import { LEVEL_BENEFITS } from '@/lib/constants';

interface LevelExpEntry {
  level: number;
  exp: number;
  total: number;
}

interface ExpActionEntry {
  action: string;
  exp: number;
  dailyLimit: number;
  description: string;
}

interface LevelConfigData {
  maxLevel: number;
  levelExp: Record<number, { exp: number }>;
  expActions: Record<string, { exp: number; dailyLimit: number }>;
  benefits: Record<number, Record<string, unknown>>;
}

export default function LevelConfigTab() {
  const { data, isLoading } = useApiGet<LevelConfigData>('/api/admin/level-config');

  if (isLoading || !data?.success || !data.data) return <Spin />;
  return <LevelConfigEditor initialConfig={data.data} />;
}

function buildLevelData(config: LevelConfigData): LevelExpEntry[] {
  const levels: LevelExpEntry[] = [];
  let runningTotal = 0;
  for (let lv = 1; lv <= config.maxLevel; lv++) {
    const expEntry = config.levelExp[lv] || { exp: 0 };
    if (lv === 1) {
      runningTotal = 0;
    } else {
      runningTotal += lv > 2 ? (config.levelExp[lv - 1]?.exp || 0) : (config.levelExp[2]?.exp || 200);
    }
    levels.push({ level: lv, exp: expEntry.exp, total: lv === 1 ? 0 : runningTotal });
  }
  return levels;
}

function buildExpActionData(config: LevelConfigData): ExpActionEntry[] {
  return Object.entries(config.expActions).map(([action, value]) => ({
    action,
    exp: value.exp,
    dailyLimit: value.dailyLimit,
    description: (value as Record<string, unknown>).description as string || '',
  }));
}

function LevelConfigEditor({ initialConfig }: { initialConfig: LevelConfigData }) {
  const t = useTranslations('admin.levelConfig');
  const [config, setConfig] = useState(initialConfig);
  const [saving, setSaving] = useState(false);
  const [levelData, setLevelData] = useState(() => buildLevelData(initialConfig));
  const [expActionData, setExpActionData] = useState(() => buildExpActionData(initialConfig));

  async function handleSave() {
    setSaving(true);
    const levelExp: Record<number, { exp: number }> = {};
    levelData.forEach(l => { levelExp[l.level] = { exp: l.exp }; });
    const expActions: Record<string, { exp: number; dailyLimit: number }> = {};
    expActionData.forEach(a => { expActions[a.action] = { exp: a.exp, dailyLimit: a.dailyLimit }; });

    const res = await apiPut<LevelConfigData>('/api/admin/level-config', {
      levelExp,
      expActions,
      benefits: config?.benefits || LEVEL_BENEFITS,
    });

    if (res.success && res.data) {
      message.success(t('saveSuccess'));
      setConfig(res.data);
    } else {
      message.error(res.error || t('saveFailed'));
    }
    setSaving(false);
  }

  function updateLevelExp(lv: number, exp: number) {
    const updated = levelData.map(l => {
      if (l.level !== lv) return l;
      return { ...l, exp };
    });
    let runningTotal = 0;
    const recalc = updated.map((l, i) => {
      if (l.level === 1) { runningTotal = 0; }
      else { runningTotal += updated[i - 1]?.exp || 0; }
      return { ...l, total: l.level === 1 ? 0 : runningTotal };
    });
    setLevelData(recalc);
  }

  function updateExpAction(idx: number, field: 'exp' | 'dailyLimit', value: number) {
    const updated = [...expActionData];
    updated[idx] = { ...updated[idx], [field]: value };
    setExpActionData(updated);
  }

  const levelColumns = [
    { title: t('level'), dataIndex: 'level', key: 'level', width: 80 },
    {
      title: t('expRequired'), dataIndex: 'exp', key: 'exp', width: 200,
      render: (_: unknown, record: LevelExpEntry) =>
        record.level === 1 ? <span className="text-gray-500">—</span> : (
          <InputNumber min={1} max={999999} value={record.exp}
            onChange={v => updateLevelExp(record.level, v || 0)}
            className="w-32" />
        ),
    },
    { title: t('totalExp'), dataIndex: 'total', key: 'total', width: 120,
      render: (v: number) => v.toLocaleString() },
  ];

  const actionColumns = [
    { title: t('action'), dataIndex: 'action', key: 'action', width: 180,
      render: (v: string) => <Tag>{v}</Tag> },
    {
      title: t('expPerAction'), dataIndex: 'exp', key: 'exp', width: 140,
      render: (_: unknown, record: ExpActionEntry, idx: number) => (
        <InputNumber min={1} max={9999} value={record.exp}
          onChange={v => updateExpAction(idx, 'exp', v || 1)}
          className="w-24" />
      ),
    },
    {
      title: t('dailyLimit'), dataIndex: 'dailyLimit', key: 'dailyLimit', width: 120,
      render: (_: unknown, record: ExpActionEntry, idx: number) => (
        <InputNumber min={1} max={9999} value={record.dailyLimit}
          onChange={v => updateExpAction(idx, 'dailyLimit', v || 1)}
          className="w-24" />
      ),
    },
    { title: t('description'), dataIndex: 'description', key: 'description',
      render: (v: string) => <span className="text-gray-400 text-xs">{v}</span> },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <Card className="!border-purple-500/10" title={t('levelThresholds')}>
        <Table dataSource={levelData} columns={levelColumns} rowKey="level"
          pagination={false} size="small" bordered={false}
          className="[&_.ant-table]:!bg-transparent" />
        <div className="text-gray-500 text-xs mt-2">
          {t('maxLevel')}: {config.maxLevel}
        </div>
      </Card>

      <Card className="!border-purple-500/10" title={t('expActions')}>
        <Table dataSource={expActionData} columns={actionColumns} rowKey="action"
          pagination={false} size="small" bordered={false}
          className="[&_.ant-table]:!bg-transparent [&_.ant-table-cell]:!bg-transparent" />
      </Card>

      <Card className="!border-purple-500/10" title={t('benefits')}>
        <Tabs items={Object.entries(LEVEL_BENEFITS).map(([lv, b]) => ({
          key: lv,
          label: `Lv.${lv}`,
          children: (
            <Descriptions size="small" column={1}>
              <Descriptions.Item label={t('benefitVoiceClones')}>{b.voiceClonesPerMonth}</Descriptions.Item>
              <Descriptions.Item label={t('benefitAssetCapacity')}>{b.assetCapacityMB} MB</Descriptions.Item>
              <Descriptions.Item label={t('benefitSavedVoices')}>{b.savedVoices}</Descriptions.Item>
              <Descriptions.Item label={t('benefitSkinSlots')}>{b.skinSlots}</Descriptions.Item>
              <Descriptions.Item label={t('benefitUnlocks')}>
                {b.unlocks.map(u => <Tag key={u}>{u}</Tag>)}
              </Descriptions.Item>
            </Descriptions>
          ),
        }))} />
      </Card>

      <Button type="primary" onClick={handleSave} loading={saving}>
        {t('saveSuccess')}
      </Button>
    </div>
  );
}
