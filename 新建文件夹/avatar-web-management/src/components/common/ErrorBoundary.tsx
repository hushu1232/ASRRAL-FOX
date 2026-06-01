'use client';

import { Component, type ReactNode } from 'react';
import { Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundaryClass extends Component<Props & { t: ReturnType<typeof useTranslations<'error'>> }, State> {
  constructor(props: Props & { t: ReturnType<typeof useTranslations<'error'>> }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const { t } = this.props;

      return (
        <div className="min-h-[60vh] flex items-center justify-center" style={{ background: 'var(--bg-deep)' }}>
          <div className="text-center max-w-md px-6">
            <div className="text-5xl mb-4">⚠</div>
            <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{t('pageLoadError')}</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              {this.state.error?.message || t('unknownError')}
            </p>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
            >
              {t('refreshPage')}
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function ErrorBoundary({ children, fallback }: Props) {
  const t = useTranslations('error');
  return (
    <ErrorBoundaryClass t={t} fallback={fallback}>
      {children}
    </ErrorBoundaryClass>
  );
}
