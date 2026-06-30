/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { App } from 'antd';
import PetSyncStatusPanel from '@/components/pet/sync/PetSyncStatusPanel';
import type { DesktopSyncStatus } from '@/lib/webbridge/sync-status';
import type { ReactNode } from 'react';

jest.mock('next-intl', () => ({
  useTranslations: (ns: string) => {
    const keys: Record<string, Record<string, string>> = {
      'pet.syncStatus': {
        title: 'Desktop sync',
        loading: 'Checking desktop sync status...',
        unavailable: 'Desktop sync status is unavailable.',
        connection: 'Connection',
        webVersion: 'Web version',
        desktopAppliedVersion: 'Desktop applied version',
        desktopKnownVersion: 'Desktop known version',
        packageState: 'Package state',
        lastSyncAt: 'Last sync',
        lastAppliedAt: 'Last applied',
        milestones: 'Reported milestones',
        localConfirmation: 'Local confirmation',
        required: 'Required',
        notRequired: 'Not required',
        notApplied: 'Not applied',
        none: 'None',
        'source.live': 'Live API',
        livePanelDescription: 'Live WebBridge status from Alife .NET 9.',
        never: 'Never',
        'summary.unknown': 'Unknown',
        'summary.desktopOffline': 'Alife .NET offline',
        'summary.pendingPull': 'Waiting for Alife .NET pull',
        'summary.localConfirmationRequired': 'Awaiting local confirmation',
        'summary.upToDate': 'Applied in Alife .NET',
        'summary.failed': 'Sync failed',
        'detail.pendingPull': 'Web has a newer package waiting for Alife .NET to pull.',
        'detail.localConfirmationRequired':
          'Package staged locally. Confirm it in Alife .NET before apply.',
        'detail.upToDate': 'Alife .NET is running the current Web version.',
        'detail.desktopOffline': 'Alife .NET is offline or has not reported recently.',
        'detail.failed': 'Review the sync error before retrying.',
        'detail.unknown': 'Status is incomplete. Check again after Alife .NET reports.',
        'lifecycle.published.title': 'Web published',
        'lifecycle.published.description': 'Web has prepared the current package.',
        'lifecycle.staged.title': 'Alife staged',
        'lifecycle.staged.description': 'Alife .NET has pulled and validated the package.',
        'lifecycle.applied.title': 'Applied',
        'lifecycle.applied.description': 'Alife .NET is running the current version.',
        'packageStateLabel.notPublished': 'Not published',
        'packageStateLabel.published': 'Published, waiting for pull',
        'packageStateLabel.pulled': 'Pulled by Alife .NET',
        'packageStateLabel.staged': 'Staged locally',
        'packageStateLabel.applied': 'Applied in Alife .NET',
        'packageStateLabel.failed': 'Package failed',
        'packageStateDescription.notPublished':
          'Publish a Web package before Alife .NET can pull.',
        'packageStateDescription.published': 'Web has a package ready for Alife .NET.',
        'packageStateDescription.pulled':
          'Alife .NET downloaded the package and is preparing it.',
        'packageStateDescription.staged': 'Alife .NET is waiting for local confirmation.',
        'packageStateDescription.applied': 'Alife .NET applied the current package.',
        'packageStateDescription.failed': 'Review the failure before retrying.',
        rawState: 'Raw state',
        localActionNotice: 'Confirm this staged package inside Alife .NET.',
        'connectionState.unknown': 'Unknown',
        'connectionState.checking': 'Checking',
        'connectionState.online': 'Online',
        'connectionState.offline': 'Offline',
        'action.checkAgain': 'Check again',
        'action.confirmInDesktop': 'Confirm in desktop',
        'action.viewDetails': 'View details',
        'actionHint.confirmInDesktop':
          'Confirm the staged package inside Alife. Web activation is not available yet.',
        'error.recovery': 'Recovery',
      },
    };
    return (key: string) => keys[ns]?.[key] ?? key;
  },
}));

jest.mock('@ant-design/icons', () => ({
  DesktopOutlined: () => <span data-testid="icon-desktop" />,
  ReloadOutlined: () => <span data-testid="icon-reload" />,
}));

function Wrapper({ children }: { children: ReactNode }) {
  return <App>{children}</App>;
}

function createStatus(overrides: Partial<DesktopSyncStatus> = {}): DesktopSyncStatus {
  return {
    desktopConnection: 'online',
    packageState: 'staged',
    summaryKind: 'localConfirmationRequired',
    primaryAction: 'confirmInDesktop',
    isUpToDate: false,
    webConfigVersion: 7,
    desktopKnownVersion: 7,
    desktopAppliedVersion: 6,
    requiresLocalConfirmation: true,
    lastSyncAt: '2026-06-27T08:00:00.000Z',
    lastAppliedAt: null,
    lastError: null,
    errorMessage: null,
    milestones: [
      'manifestFetched',
      'filesDownloaded',
      'hashValidated',
      'packageStaged',
      'confirmationRequested',
    ],
    ...overrides,
  };
}

describe('PetSyncStatusPanel', () => {
  it('shows loading text when status is unavailable and loading', () => {
    render(<PetSyncStatusPanel status={null} loading onRefresh={jest.fn()} />, {
      wrapper: Wrapper,
    });

    expect(screen.getByText('Checking desktop sync status...')).toBeDefined();
  });

  it('shows unavailable state and calls onRefresh from check-again action', () => {
    const onRefresh = jest.fn();
    render(<PetSyncStatusPanel status={null} loading={false} onRefresh={onRefresh} />, {
      wrapper: Wrapper,
    });

    expect(screen.getByText('Desktop sync status is unavailable.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /check again/i }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('localConfirmationRequired state shows lifecycle rail and staged package detail', () => {
    render(<PetSyncStatusPanel status={createStatus()} loading={false} onRefresh={jest.fn()} />, {
      wrapper: Wrapper,
    });

    expect(screen.getByText('Awaiting local confirmation')).toBeDefined();
    expect(screen.getByText('Live API')).toBeDefined();
    expect(
      screen.getByText('Package staged locally. Confirm it in Alife .NET before apply.'),
    ).toBeDefined();
    expect(screen.getByText('Web published')).toBeDefined();
    expect(screen.getByText('Web has prepared the current package.')).toBeDefined();
    expect(screen.getByText('Alife staged')).toBeDefined();
    expect(screen.getByText('Alife .NET has pulled and validated the package.')).toBeDefined();
    expect(screen.getByText('Applied')).toBeDefined();
    expect(screen.getByText('Alife .NET is running the current version.')).toBeDefined();
    expect(screen.getByText('Staged locally')).toBeDefined();
    expect(screen.getByText('Alife .NET is waiting for local confirmation.')).toBeDefined();
    expect(screen.getByText('Raw state')).toBeDefined();
    expect(screen.getByText('staged')).toBeDefined();
    expect(screen.getByText('Confirm this staged package inside Alife .NET.')).toBeDefined();
    expect(screen.getAllByText('7').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('manifestFetched')).toBeDefined();
    expect(screen.getByText('confirmationRequested')).toBeDefined();
    expect(screen.getByRole('button', { name: /confirm in desktop/i })).toBeDisabled();
    expect(screen.getByText('Required')).toBeDefined();
  });

  it('marks the panel as the live Alife .NET sync source', () => {
    render(<PetSyncStatusPanel status={createStatus()} loading={false} onRefresh={jest.fn()} />, {
      wrapper: Wrapper,
    });

    expect(screen.getByTestId('live-sync-status-panel')).toBeDefined();
    expect(screen.getByText('Live WebBridge status from Alife .NET 9.')).toBeDefined();
    expect(screen.getByText('Live API')).toBeDefined();
    expect(screen.getByText('Raw state')).toBeDefined();
  });

  it('pendingPull state shows lifecycle rail and published package detail', () => {
    render(
      <PetSyncStatusPanel
        status={createStatus({
          packageState: 'published',
          summaryKind: 'pendingPull',
          primaryAction: 'checkAgain',
          desktopKnownVersion: 6,
          desktopAppliedVersion: 6,
          requiresLocalConfirmation: false,
          milestones: ['manifestFetched'],
        })}
        loading={false}
        onRefresh={jest.fn()}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByText('Waiting for Alife .NET pull')).toBeDefined();
    expect(
      screen.getByText('Web has a newer package waiting for Alife .NET to pull.'),
    ).toBeDefined();
    expect(screen.getByText('Published, waiting for pull')).toBeDefined();
    expect(screen.getByText('Web has a package ready for Alife .NET.')).toBeDefined();
    expect(screen.getByText('Web published')).toBeDefined();
    expect(screen.getByText('Web has prepared the current package.')).toBeDefined();
    expect(screen.getByText('Alife staged')).toBeDefined();
    expect(screen.getByText('Alife .NET has pulled and validated the package.')).toBeDefined();
    expect(screen.getByText('Applied')).toBeDefined();
    expect(screen.getByText('Alife .NET is running the current version.')).toBeDefined();
  });

  it('upToDate state shows summary and no check-again action', () => {
    render(
      <PetSyncStatusPanel
        status={createStatus({
          packageState: 'applied',
          summaryKind: 'upToDate',
          primaryAction: 'none',
          isUpToDate: true,
          desktopAppliedVersion: 7,
          requiresLocalConfirmation: false,
        })}
        loading={false}
        onRefresh={jest.fn()}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getAllByText('Applied in Alife .NET').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole('button', { name: /check again/i })).toBeNull();
  });

  it('desktopOffline checkAgain click calls onRefresh', () => {
    const onRefresh = jest.fn();
    render(
      <PetSyncStatusPanel
        status={createStatus({
          desktopConnection: 'offline',
          packageState: 'published',
          summaryKind: 'desktopOffline',
          primaryAction: 'checkAgain',
        })}
        loading={false}
        onRefresh={onRefresh}
      />,
      { wrapper: Wrapper },
    );

    fireEvent.click(screen.getByRole('button', { name: /check again/i }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('failed state shows error code and technical detail', () => {
    render(
      <PetSyncStatusPanel
        status={createStatus({
          packageState: 'failed',
          summaryKind: 'failed',
          primaryAction: 'viewDetails',
          lastError: {
            code: 'PACKAGE_HASH_MISMATCH',
            message: 'Package validation failed',
            technicalDetail: 'Expected sha256 abc but received def',
          },
        })}
        loading={false}
        onRefresh={jest.fn()}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByText('PACKAGE_HASH_MISMATCH')).toBeDefined();
    expect(screen.getByText('Expected sha256 abc but received def')).toBeDefined();
  });

  it('failed state shows computed recovery guidance when available', () => {
    render(
      <PetSyncStatusPanel
        status={createStatus({
          packageState: 'failed',
          summaryKind: 'failed',
          primaryAction: 'viewDetails',
          lastError: {
            code: 'PACKAGE_HASH_MISMATCH',
          },
          errorMessage: {
            title: 'Package validation failed',
            recovery: 'Re-download the package from the Web management app.',
          },
        })}
        loading={false}
        onRefresh={jest.fn()}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByText('Package validation failed')).toBeDefined();
    expect(screen.getByText('Re-download the package from the Web management app.')).toBeDefined();
  });
});
