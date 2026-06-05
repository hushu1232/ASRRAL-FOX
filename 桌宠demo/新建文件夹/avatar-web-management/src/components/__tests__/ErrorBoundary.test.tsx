/**
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import ErrorBoundary from '@/components/common/ErrorBoundary';

jest.mock('@ant-design/icons', () => ({
  ReloadOutlined: () => <span data-testid="icon-reload" />,
}));

function ThrowError(): never {
  throw new Error('Test explosion');
}

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">Hello World</div>
      </ErrorBoundary>
    );
    expect(screen.getByTestId('child')).toBeDefined();
    expect(screen.getByText('Hello World')).toBeDefined();
  });

  it('renders error UI when child throws', () => {
    // Suppress console.error from the intentional throw
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );
    expect(screen.getByText('pageLoadError')).toBeDefined();
    spy.mockRestore();
  });

  it('renders custom fallback on error', () => {
    const fallback = <div data-testid="fallback">Custom Error UI</div>;
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary fallback={fallback}>
        <ThrowError />
      </ErrorBoundary>
    );
    expect(screen.getByTestId('fallback')).toBeDefined();
    spy.mockRestore();
  });
});
