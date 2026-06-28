/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { App } from 'antd';
import type { ReactNode } from 'react';
import WebBridgeMockStatusPanel from '@/components/pet/sync/WebBridgeMockStatusPanel';

jest.mock('@ant-design/icons', () => ({
  ApiOutlined: () => <span data-testid="icon-api" />,
  CheckCircleOutlined: () => <span data-testid="icon-check" />,
  ClockCircleOutlined: () => <span data-testid="icon-clock" />,
  CloudServerOutlined: () => <span data-testid="icon-cloud" />,
  ExclamationCircleOutlined: () => <span data-testid="icon-warning" />,
  SafetyCertificateOutlined: () => <span data-testid="icon-safety" />,
}));

function Wrapper({ children }: { children: ReactNode }) {
  return <App>{children}</App>;
}

describe('WebBridgeMockStatusPanel', () => {
  it('shows the isolated Alife .NET 9 package install mock flow', () => {
    render(<WebBridgeMockStatusPanel />, { wrapper: Wrapper });

    expect(screen.getByText('Alife .NET 9')).toBeDefined();
    expect(screen.getByText('Mock')).toBeDefined();
    expect(screen.getByText('Preflight')).toBeDefined();
    expect(screen.getByText('Package manifest')).toBeDefined();
    expect(screen.getByText('SHA-256 validation')).toBeDefined();
    expect(screen.getByText('Pending activation')).toBeDefined();
    expect(screen.getByText('pendingActivation')).toBeDefined();
    expect(screen.getByText('D:\\tmp\\alife-webbridge-integration')).toBeDefined();
  });

  it('surfaces expected failure reasons without connecting to the runtime', () => {
    render(<WebBridgeMockStatusPanel />, { wrapper: Wrapper });

    expect(screen.getByText('401 package file')).toBeDefined();
    expect(screen.getByText('PACKAGE_HASH_MISMATCH')).toBeDefined();
    expect(screen.getByText('PACKAGE_SECURITY_BLOCKED')).toBeDefined();
    expect(screen.getByText('No live Alife calls')).toBeDefined();
  });

  it('switches between mock package install scenarios without network calls', () => {
    const originalFetch = global.fetch;
    const fetchSpy = jest.fn();
    Object.defineProperty(global, 'fetch', {
      configurable: true,
      writable: true,
      value: fetchSpy,
    });

    render(<WebBridgeMockStatusPanel />, { wrapper: Wrapper });

    expect(screen.getByText('Mock scenario')).toBeDefined();
    expect(screen.getAllByText('Local operator review before apply').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText('Auth failure'));
    expect(
      screen.getAllByText('Refresh package bearer token before download').length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('401 package file').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText('Hash mismatch'));
    expect(screen.getAllByText('Reject package and re-download bundle').length).toBeGreaterThan(0);
    expect(screen.getAllByText('PACKAGE_HASH_MISMATCH').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText('Security block'));
    expect(
      screen.getAllByText('Keep activation disabled until path validation passes').length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('PACKAGE_SECURITY_BLOCKED').length).toBeGreaterThan(0);

    expect(fetchSpy).not.toHaveBeenCalled();
    if (originalFetch) {
      Object.defineProperty(global, 'fetch', {
        configurable: true,
        writable: true,
        value: originalFetch,
      });
    } else {
      delete (global as Partial<typeof globalThis>).fetch;
    }
  });
});
