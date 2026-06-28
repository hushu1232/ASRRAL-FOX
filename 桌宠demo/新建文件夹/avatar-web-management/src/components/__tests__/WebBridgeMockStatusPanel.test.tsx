/**
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
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
});
