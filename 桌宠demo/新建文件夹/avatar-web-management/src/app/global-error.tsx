'use client';

import { useEffect } from 'react';
import { Button } from 'antd';
import { ReloadOutlined, HomeOutlined } from '@ant-design/icons';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <html lang="zh-CN">
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#09090F',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          <div style={{ textAlign: 'center', maxWidth: 480, padding: '0 24px' }}>
            <div style={{ fontSize: 64, marginBottom: 16, lineHeight: 1 }}>500</div>
            <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
              服务器错误
            </h1>
            <p style={{ color: '#9ca3af', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
              应用遇到了意外错误，请尝试刷新页面。如果问题持续存在，请联系技术支持。
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <Button type="primary" icon={<ReloadOutlined />} onClick={reset}>
                重试
              </Button>
              <Link href="/">
                <Button icon={<HomeOutlined />}>返回首页</Button>
              </Link>
            </div>
            {error.digest && (
              <p style={{ color: '#4b5563', fontSize: 11, marginTop: 24 }}>
                Error ID: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
