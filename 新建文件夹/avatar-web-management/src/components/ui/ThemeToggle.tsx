'use client';

import { Button, Tooltip } from 'antd';
import { SunOutlined, MoonOutlined, LaptopOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { useUIStore, type ThemeMode } from '@/stores/uiStore';

const modes: { mode: ThemeMode; icon: typeof SunOutlined; label: string }[] = [
  { mode: 'light', icon: SunOutlined, label: 'light' },
  { mode: 'dark', icon: MoonOutlined, label: 'dark' },
  { mode: 'system', icon: LaptopOutlined, label: 'system' },
];

export default function ThemeToggle() {
  const t = useTranslations('theme');
  const themeMode = useUIStore((s) => s.themeMode);
  const setThemeMode = useUIStore((s) => s.setThemeMode);

  const cycleTheme = () => {
    const idx = modes.findIndex((m) => m.mode === themeMode);
    const next = modes[(idx + 1) % modes.length];
    setThemeMode(next.mode);
  };

  const current = modes.find((m) => m.mode === themeMode)!;
  const Icon = current.icon;

  return (
    <Tooltip title={t(current.label)}>
      <Button
        type="text"
        icon={<Icon />}
        onClick={cycleTheme}
        aria-label={t('switchTo', { mode: t(current.label) })}
        style={{ color: 'var(--text-secondary)' }}
      />
    </Tooltip>
  );
}
