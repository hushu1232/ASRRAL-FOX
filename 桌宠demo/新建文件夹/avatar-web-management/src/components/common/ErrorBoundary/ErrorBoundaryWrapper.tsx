'use client';

import { Suspense, lazy, ComponentType, LazyExoticComponent } from 'react';
import { Spin } from 'antd';

// ─── Loading fallbacks ─────────────────────────────────────────

function DefaultSuspenseFallback() {
  return (
    <div className="min-h-[300px] flex items-center justify-center">
      <Spin size="large" />
    </div>
  );
}

function InlineSuspenseFallback() {
  return (
    <div className="flex items-center justify-center py-8">
      <Spin size="small" />
    </div>
  );
}

// ─── Suspense wrapper ──────────────────────────────────────────

interface SuspenseWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  /** Use a compact spinner for inline components (charts, small widgets) */
  inline?: boolean;
}

/**
 * Suspense 边界包装器。
 * 所有使用 dynamic(() => import(...)) 懒加载的组件都应该包裹在 Suspense 中。
 *
 * @example
 * <SuspenseWrapper>
 *   <MyLazyComponent />
 * </SuspenseWrapper>
 */
export function SuspenseWrapper({ children, fallback, inline }: SuspenseWrapperProps) {
  return (
    <Suspense fallback={fallback ?? (inline ? <InlineSuspenseFallback /> : <DefaultSuspenseFallback />)}>
      {children}
    </Suspense>
  );
}

// ── Feature section wrapper ────────────────────────────────────

interface FeatureSectionProps {
  children: React.ReactNode;
  /** Feature name for error attribution (shown in error message) */
  featureName: string;
  fallback?: React.ReactNode;
  suspense?: boolean;
}

/**
 * 功能模块包装器：同时提供 ErrorBoundary + 可选的 Suspense 边界。
 * 每个独立功能区域（Dashboard、Marketplace、PetPreview 等）都应该用此包装。
 *
 * @example
 * <FeatureSection featureName="Dashboard">
 *   <DashboardContent />
 * </FeatureSection>
 */
export function FeatureSection({ children, featureName, fallback, suspense }: FeatureSectionProps) {
  const content = suspense ? (
    <SuspenseWrapper inline>{children}</SuspenseWrapper>
  ) : (
    children
  );

  return (
    <ErrorBoundaryLight featureName={featureName} fallback={fallback}>
      {content}
    </ErrorBoundaryLight>
  );
}

// ── Lightweight Error Boundary ─────────────────────────────────

interface ErrorBoundaryLightProps {
  children: React.ReactNode;
  featureName: string;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryLightState {
  hasError: boolean;
  error: Error | null;
}

import React from 'react';

class ErrorBoundaryLight extends React.Component<ErrorBoundaryLightProps, ErrorBoundaryLightState> {
  constructor(props: ErrorBoundaryLightProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryLightState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.featureName}]`, error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          role="alert"
          className="flex flex-col items-center justify-center gap-3 py-12 px-6 text-center rounded-lg border mx-4 my-4"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="text-3xl opacity-40">⚠️</div>
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            {this.props.featureName} 加载失败
          </h3>
          <p className="text-sm max-w-md" style={{ color: 'var(--text-secondary)' }}>
            {this.state.error?.message || '发生了未知错误'}
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="px-4 py-2 rounded-md text-sm font-medium text-white cursor-pointer border-none"
            style={{ background: 'var(--accent)' }}
          >
            重试
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
