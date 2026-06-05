'use client';

import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { WifiOutlined } from '@ant-design/icons';

/**
 * 网络状态指示器。
 *
 * 显示在页面底部或 Header 中，提醒用户当前网络状态。
 * - 在线：不显示（零干扰）
 * - 离线：显示红色横幅提示
 * - 弱网/重连中：显示黄色提示
 */
export default function NetworkStatusIndicator() {
  const { online, checking, offlineDuration } = useNetworkStatus(30_000);

  // Online and stable — don't show anything
  if (online && !checking) return null;

  const secondsOffline = Math.floor(offlineDuration / 1000);
  const offlineTimeStr =
    secondsOffline < 60
      ? `${secondsOffline}s`
      : `${Math.floor(secondsOffline / 60)}m ${secondsOffline % 60}s`;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-300"
      style={{
        background: online
          ? 'var(--warning)'  // Reconnecting
          : 'var(--danger)',    // Offline
        color: '#fff',
      }}
    >
      <WifiOutlined className={checking ? 'animate-pulse' : ''} />
      {!online && (
        <span>
          网络连接断开 · 已离线 {offlineTimeStr} · 星尘正在等待重连...
        </span>
      )}
      {online && checking && (
        <span>正在重新连接...</span>
      )}
    </div>
  );
}
