'use client';

import { useEffect, useState } from 'react';
import { Card, Tag, Button, message, Spin, Empty } from 'antd';
import { CrownOutlined, LockOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { apiGet, apiPut } from '@/lib/api-client';
import { TITLE_DEFINITIONS, TitleDef } from '@/lib/constants';

interface TitleStatus {
  definition: TitleDef;
  unlocked: boolean;
}

interface TitlesData {
  activeTitle: string | null;
  titles: TitleStatus[];
}

export default function TitleTab() {
  const t = useTranslations('settings.titles');
  const [data, setData] = useState<TitlesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [equipping, setEquipping] = useState<string | null>(null);

  useEffect(() => {
    fetchTitles();
  }, []);

  async function fetchTitles() {
    setLoading(true);
    const res = await apiGet<TitlesData>('/api/user/titles');
    if (res.success && res.data) setData(res.data);
    setLoading(false);
  }

  async function handleEquip(titleId: string | null) {
    setEquipping(titleId || '__unequip__');
    const res = await apiPut('/api/user/titles', { activeTitle: titleId });
    if (res.success) {
      message.success(t('equipSuccess'));
      fetchTitles();
    } else {
      message.error(res.error || t('equipFailed'));
    }
    setEquipping(null);
  }

  if (loading || !data) return <Spin />;

  const categories = {
    login: { label: t('categories.login'), titles: data.titles.filter(s => s.definition.category === 'login') },
    achievement: { label: t('categories.achievement'), titles: data.titles.filter(s => s.definition.category === 'achievement') },
    admin: { label: t('categories.admin'), titles: data.titles.filter(s => s.definition.category === 'admin') },
  };

  const unlockedCount = data.titles.filter(s => s.unlocked).length;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-white text-lg font-bold">
            {data.activeTitle
              ? <><CrownOutlined className="text-yellow-400 mr-1" />{data.activeTitle}</>
              : <span className="text-gray-400">{t('noTitle')}</span>
            }
          </div>
          <div className="text-gray-500 text-xs mt-1">{t('unlockedCount', { count: unlockedCount, total: data.titles.length })}</div>
        </div>
        {data.activeTitle && (
          <Button size="small" onClick={() => handleEquip(null)}
            loading={equipping === '__unequip__'}>
            {t('unequip')}
          </Button>
        )}
      </div>

      {Object.entries(categories).map(([cat, { label, titles }]) => (
        <Card key={cat} className="!border-purple-500/10" title={label}>
          {titles.length === 0 ? (
            <Empty description={false} className="my-4" />
          ) : (
            <div className="space-y-3">
              {titles.map(status => {
                const { definition: def, unlocked } = status;
                const isActive = data.activeTitle === def.id;
                return (
                  <div key={def.id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors
                      ${isActive ? 'border-purple-500 bg-purple-500/10' :
                        unlocked ? 'border-gray-700 bg-gray-800/50 hover:border-purple-500/50' :
                        'border-gray-800 bg-gray-900/30 opacity-60'}`}>
                    <div className="flex items-center gap-3">
                      <Tag color={isActive ? 'purple' : unlocked ? 'blue' : 'default'}
                        className="!m-0">
                        {def.id}
                      </Tag>
                      <div>
                        <div className={`font-medium ${unlocked ? 'text-white' : 'text-gray-500'}`}>
                          {def.name}
                          {isActive && <CrownOutlined className="ml-1 text-yellow-400 text-xs" />}
                        </div>
                        <div className="text-gray-500 text-xs">{def.condition}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {unlocked ? (
                        <CheckCircleOutlined className="text-green-500" />
                      ) : (
                        <LockOutlined className="text-gray-600" />
                      )}
                      {unlocked && !isActive && (
                        <Button size="small" type="primary"
                          onClick={() => handleEquip(def.id)}
                          loading={equipping === def.id}>
                          {t('equip')}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
