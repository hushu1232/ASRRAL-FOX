'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface NetworkStatus {
  /** 浏览器报告的网络状态 */
  online: boolean;
  /** 是否正在检查连接（主动 ping） */
  checking: boolean;
  /** 上次 ping 是否成功 */
  lastPingOk: boolean | null;
  /** 手动触发连接检查 */
  checkConnection: () => Promise<boolean>;
  /** 自上次在线后的断线时间（ms），在线时为 0 */
  offlineDuration: number;
}

/**
 * 网络状态检测 hook。
 *
 * 结合 navigator.onLine 事件 + 主动 ping /api/health，
 * 避免浏览器 "在线但实际无法连接" 的假阳性。
 *
 * @param pingIntervalMs 主动 ping 间隔（默认 30s，0 表示不主动 ping）
 */
export function useNetworkStatus(pingIntervalMs = 30_000): NetworkStatus {
  const [online, setOnline] = useState(true);
  const [checking, setChecking] = useState(false);
  const [lastPingOk, setLastPingOk] = useState<boolean | null>(null);
  const lastOnlineTimeRef = useRef<number | null>(null);
  const [offlineDuration, setOfflineDuration] = useState(0);

  // Listen to browser online/offline events
  useEffect(() => {
    const setOnlineNow = () => {
      lastOnlineTimeRef.current = Date.now();
      setOnline(true);
      setOfflineDuration(0);
    };
    const handleOnline = () => setOnlineNow();
    const handleOffline = () => {
      if (lastOnlineTimeRef.current === null) lastOnlineTimeRef.current = Date.now();
      setOnline(false);
    };

    if (navigator.onLine) {
      setOnlineNow();
    } else {
      handleOffline();
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update offline duration timer
  useEffect(() => {
    if (online) {
      setOfflineDuration(0);
      return;
    }
    const timer = setInterval(() => {
      const lastOnlineTime = lastOnlineTimeRef.current ?? Date.now();
      setOfflineDuration(Date.now() - lastOnlineTime);
    }, 1000);
    return () => clearInterval(timer);
  }, [online]);

  // Active ping
  const checkConnection = useCallback(async (): Promise<boolean> => {
    setChecking(true);
    try {
      const res = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-store',
        // Short timeout for offline detection
        signal: AbortSignal.timeout(5000),
      });
      const ok = res.ok;
      setLastPingOk(ok);
      if (ok) {
        setOnline(true);
        lastOnlineTimeRef.current = Date.now();
      }
      return ok;
    } catch {
      setLastPingOk(false);
      setOnline(false);
      return false;
    } finally {
      setChecking(false);
    }
  }, []);

  // Periodic ping
  useEffect(() => {
    if (pingIntervalMs <= 0) return;
    // Ping on mount
    checkConnection();
    const timer = setInterval(checkConnection, pingIntervalMs);
    return () => clearInterval(timer);
  }, [pingIntervalMs, checkConnection]);

  return {
    online,
    checking,
    lastPingOk,
    checkConnection,
    offlineDuration,
  };
}
