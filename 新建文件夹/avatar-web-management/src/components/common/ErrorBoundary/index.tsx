'use client';

import React from 'react';
import { CloseCircleOutlined } from '@ant-design/icons';
import './style.scss';

interface Props { children: React.ReactNode; fallback?: React.ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="error-boundary" role="alert">
          <CloseCircleOutlined className="error-boundary__icon" />
          <h2 className="error-boundary__title">Something went wrong</h2>
          <p className="error-boundary__message">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button type="button" className="error-boundary__retry-btn" onClick={this.handleRetry}>
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
