'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button, Card, Input, InputNumber, Select, Slider, Space, Spin, Typography, message } from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { AVATAR_STYLES } from '@/lib/constants';
import { apiPost, apiPut } from '@/lib/api-client';
import { useApiGet } from '@/lib/use-api';

type BodyParams = {
  height: number;
  shoulder: number;
  waist: number;
  arm_length: number;
  leg_length: number;
};

type AvatarVersion = {
  blendshape_snapshot?: Record<string, number>;
  body_params?: Partial<BodyParams>;
  equipped_parts?: { slot: string; part_id: string }[];
  material_overrides?: Record<string, { albedo: string; roughness: number; metallic: number }>;
};

type AvatarDetail = {
  id: string;
  name: string;
  style: string;
  base_model: string;
  versions?: AvatarVersion[];
};

const DEFAULT_BODY_PARAMS: BodyParams = {
  height: 0,
  shoulder: 0,
  waist: 0,
  arm_length: 0,
  leg_length: 0,
};

const BODY_PARAM_KEYS: (keyof BodyParams)[] = ['height', 'shoulder', 'waist', 'arm_length', 'leg_length'];

export default function AvatarEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations('editor');
  const ta = useTranslations('avatars');
  const [messageApi, contextHolder] = message.useMessage();
  const id = params?.id;
  const { data, isLoading, mutate } = useApiGet<AvatarDetail>(id ? `/api/avatars/${id}` : null);
  const avatar = data?.success ? data.data : null;
  const initializedFor = useRef<string | null>(null);
  const [name, setName] = useState('');
  const [style, setStyle] = useState('anime');
  const [bodyParams, setBodyParams] = useState<BodyParams>(DEFAULT_BODY_PARAMS);
  const [blendShapes, setBlendShapes] = useState<Record<string, number>>({ eye_size: 0 });
  const [equippedParts, setEquippedParts] = useState<{ slot: string; part_id: string }[]>([]);
  const [materialOverrides, setMaterialOverrides] = useState<NonNullable<AvatarVersion['material_overrides']>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!avatar || initializedFor.current === avatar.id) return;
    const version = avatar.versions?.[0];
    initializedFor.current = avatar.id;
    setName(avatar.name);
    setStyle(avatar.style);
    setBodyParams({ ...DEFAULT_BODY_PARAMS, ...version?.body_params });
    setBlendShapes({ eye_size: 0, ...version?.blendshape_snapshot });
    setEquippedParts(version?.equipped_parts || []);
    setMaterialOverrides(version?.material_overrides || {});
  }, [avatar]);

  if (isLoading) {
    return <div className="flex justify-center py-20"><Spin size="large" /></div>;
  }

  if (!avatar) {
    return (
      <div className="text-center py-20">
        <Typography.Text>{ta('notFound')}</Typography.Text>
        <div className="mt-4"><Button onClick={() => router.push('/avatars')}>{ta('backToList')}</Button></div>
      </div>
    );
  }

  const setBodyParam = (key: keyof BodyParams, value: number | null) => {
    setBodyParams((current) => ({ ...current, [key]: value ?? 0 }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const avatarResult = await apiPut(`/api/avatars/${avatar.id}`, { name, style });
      if (!avatarResult.success) throw new Error(avatarResult.error || t('toolbar.saveFailed'));

      const versionResult = await apiPost(`/api/avatars/${avatar.id}/versions`, {
        blendshape_snapshot: blendShapes,
        body_params: bodyParams,
        equipped_parts: equippedParts,
        material_overrides: materialOverrides,
      });
      if (!versionResult.success) throw new Error(versionResult.error || t('saveVersion.saveFailed'));

      await mutate();
      messageApi.success(t('toolbar.saveSuccess'));
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : t('toolbar.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {contextHolder}
      <div className="flex items-center justify-between gap-4 mb-6">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push(`/avatars/${avatar.id}`)} />
          <Typography.Title level={2} className="!mb-0">{name || avatar.name}</Typography.Title>
        </Space>
        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
          {t('toolbar.save')}
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card title={ta('detail.basicInfo')} className="xl:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex flex-col gap-2">
              <span>{ta('create.name')}</span>
              <Input value={name} maxLength={64} onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="flex flex-col gap-2">
              <span>{ta('create.style')}</span>
              <Select value={style} options={[...AVATAR_STYLES]} onChange={setStyle} />
            </label>
            <label className="flex flex-col gap-2">
              <span>{ta('create.baseModel')}</span>
              <Input value={avatar.base_model} disabled />
            </label>
          </div>
        </Card>

        <Card title={t('propertyPanel.blendShapes')}>
          <label className="flex flex-col gap-2">
            <span>eye_size</span>
            <Slider
              min={-1}
              max={1}
              step={0.01}
              value={blendShapes.eye_size ?? 0}
              onChange={(value) => setBlendShapes((current) => ({ ...current, eye_size: value }))}
            />
            <InputNumber
              min={-1}
              max={1}
              step={0.01}
              value={blendShapes.eye_size ?? 0}
              onChange={(value) => setBlendShapes((current) => ({ ...current, eye_size: value ?? 0 }))}
            />
          </label>
        </Card>

        <Card title={t('propertyPanel.bodyParams')} className="xl:col-span-3">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
            {BODY_PARAM_KEYS.map((key) => (
              <label key={key} className="flex flex-col gap-2">
                <span>{t(`propertyPanel.${key === 'arm_length' ? 'armLength' : key === 'leg_length' ? 'legLength' : key}`)}</span>
                <Slider
                  min={-1}
                  max={1}
                  step={0.01}
                  value={bodyParams[key]}
                  onChange={(value) => setBodyParam(key, value)}
                />
                <InputNumber
                  min={-1}
                  max={1}
                  step={0.01}
                  value={bodyParams[key]}
                  onChange={(value) => setBodyParam(key, value)}
                />
              </label>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
