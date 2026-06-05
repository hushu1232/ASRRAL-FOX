/**
 * 离线回退页面
 *
 * 当用户离线访问时，Service Worker 返回此页面。
 * 提供基础信息和网络恢复后的重试引导。
 */
'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Button } from 'antd';
import { ReloadOutlined, WifiOutlined } from '@ant-design/icons';

export default function OfflinePage() {
  const [checking, setChecking] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetry = async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      if (res.ok) {
        window.location.href = '/';
        return;
      }
    } catch {
      // Still offline
    }
    // Check browser's own signal
    if (navigator.onLine) {
      window.location.href = '/';
      return;
    }
    setChecking(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg-deep)' }}>
      <div
        className="flex flex-col items-center text-center gap-6 max-w-sm p-8 rounded-2xl"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
      >
        {/* Pet mascot */}
        <div className="relative">
          <div className="text-6xl">🦊</div>
          {!isOnline && (
            <div
              className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 flex items-center justify-center"
              style={{ background: 'var(--danger)', borderColor: 'var(--bg-card)' }}
            >
              <span className="text-white text-[10px]">✕</span>
            </div>
          )}
          {isOnline && (
            <div
              className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 flex items-center justify-center"
              style={{ background: 'var(--success)', borderColor: 'var(--bg-card)' }}
            >
              <WifiOutlined className="text-white text-[10px]" />
            </div>
          )}
        </div>

        <div>
          <h1 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            {isOnline ? '连接已恢复' : '网络连接断开'}
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {isOnline
              ? '网络已恢复！星尘正在等你回来～'
              : '星尘暂时无法连接到服务器。请检查网络后重试。离线期间，已缓存的内容仍可查看。'}
          </p>
        </div>

        <Button
          type="primary"
          icon={<ReloadOutlined spin={checking} />}
          onClick={handleRetry}
          loading={checking}
          size="large"
        >
          {checking ? '检测连接中...' : '重新连接'}
        </Button>

        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          离线模式 · AstralFox Desktop Pet
        </p>
      </div>
    </div>
  );
}
