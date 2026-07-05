/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { App } from 'antd';
import type { ReactNode } from 'react';
import WebBridgeMockStatusPanel from '@/components/pet/sync/WebBridgeMockStatusPanel';

const mockMessages: Record<string, string> = {
  title: 'WebBridge package simulation',
  simulationOnly: 'Simulation only',
  scenarioLabel: 'Simulation scenario',
  runtime: 'Runtime',
  packageState: 'Package state',
  nextAction: 'Next action',
  isolation: 'Isolation',
  noLiveCalls: 'No live Alife calls',
  packageRoot: 'Package root',
  manifest: 'Manifest',
  file: 'File',
  scenarioDetail: 'Scenario detail',
  failureStates: 'Failure states',
  activationGuard: 'Activation guard',
  autoApplyGuard: 'autoApply=false, requiresLocalConfirmation=true',
  readOnlyNotice: 'This panel is a read-only simulation and does not call local Alife.',
  'scenario.pendingActivation.label': 'Ready package',
  'scenario.pendingActivation.nextAction': 'Confirm inside Alife .NET before apply',
  'scenario.pendingActivation.detail':
    'Package passed preflight, manifest, and SHA-256 checks. Alife .NET holds activation for local confirmation.',
  'scenario.unauthorized.label': 'Auth failure',
  'scenario.unauthorized.nextAction': 'Refresh package bearer token before download',
  'scenario.unauthorized.detail':
    'The manifest can be reached, but a package file request is rejected by authorization.',
  'scenario.hashMismatch.label': 'Hash mismatch',
  'scenario.hashMismatch.nextAction': 'Reject package and re-download bundle',
  'scenario.hashMismatch.detail':
    'The downloaded file digest does not match the signed package manifest.',
  'scenario.securityBlocked.label': 'Security block',
  'scenario.securityBlocked.nextAction': 'Keep activation disabled until path validation passes',
  'scenario.securityBlocked.detail':
    'A path traversal or unsafe package file target is blocked before activation.',
  'check.preflight.label': 'Preflight',
  'check.preflight.detail': 'WebBridge readiness',
  'check.manifest.label': 'Package manifest',
  'check.manifest.detail': 'current-pet-character-bundle',
  'check.hash.label': 'SHA-256 validation',
  'check.hash.detail': 'character-card',
  'check.pending.label': 'Pending local confirmation',
  'check.pending.detail': 'Alife .NET apply guard',
  'state.ready': 'Ready',
  'state.waiting': 'Waiting',
  'state.failed': 'Failed',
  'state.blocked': 'Blocked',
};

jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    if (namespace !== 'pet.webbridgeMock') {
      return (key: string) => key;
    }

    return (key: string) => mockMessages[key] ?? key;
  },
}));

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

    expect(screen.getByTestId('webbridge-mock-simulation-panel')).toBeDefined();
    expect(screen.getByTestId('webbridge-mock-evidence-grid')).toBeDefined();
    expect(screen.getByTestId('webbridge-mock-simulation-panel').textContent).toContain(
      'Simulation only',
    );
    expect(screen.getByText('WebBridge package simulation')).toBeDefined();
    expect(screen.getByText('Simulation only')).toBeDefined();
    expect(screen.getByText('Alife .NET 9')).toBeDefined();
    expect(screen.getByText('No live Alife calls')).toBeDefined();
    expect(screen.getByText('Preflight')).toBeDefined();
    expect(screen.getByText('Package manifest')).toBeDefined();
    expect(screen.getByText('SHA-256 validation')).toBeDefined();
    expect(screen.getByText('Pending local confirmation')).toBeDefined();
    expect(screen.getAllByText('Confirm inside Alife .NET before apply').length).toBeGreaterThan(0);
    expect(screen.getByText('pendingActivation')).toBeDefined();
    expect(screen.getByText('D:\\FOXD\\.worktrees\\_alife-webbridge-integration')).toBeDefined();
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

    expect(screen.getByText('Simulation scenario')).toBeDefined();
    expect(screen.getAllByText('Confirm inside Alife .NET before apply').length).toBeGreaterThan(0);

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
