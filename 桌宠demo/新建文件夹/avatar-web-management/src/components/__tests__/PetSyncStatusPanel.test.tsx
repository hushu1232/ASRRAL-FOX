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
        lastSyncAt: 'Last sync',
        lastAppliedAt: 'Last applied',
        localConfirmation: 'Local confirmation',
        required: 'Required',
        notRequired: 'Not required',
        notApplied: 'Not applied',
        never: 'Never',
        'summary.unknown': 'Unknown',
        'summary.desktopOffline': 'Desktop offline',
        'summary.pendingPull': 'Pending pull',
        'summary.localConfirmationRequired': 'Desktop confirmation required',
        'summary.upToDate': 'Up to date',
        'summary.failed': 'Sync failed',
        'connectionState.unknown': 'Unknown',
        'connectionState.checking': 'Checking',
        'connectionState.online': 'Online',
        'connectionState.offline': 'Offline',
        'action.checkAgain': 'Check again',
        'action.confirmInDesktop': 'Confirm in desktop',
        'action.viewDetails': 'View details',
        'error.recovery': 'Recovery',
      },
    };
    return (key: string) => keys[ns]?.[key] ?? key;
  },
}));

jest.mock('@ant-design/icons', () => ({
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
    milestones: [],
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

  it('localConfirmationRequired state shows summary and confirm button', () => {
    render(<PetSyncStatusPanel status={createStatus()} loading={false} onRefresh={jest.fn()} />, {
      wrapper: Wrapper,
    });

    expect(screen.getByText('Desktop confirmation required')).toBeDefined();
    expect(screen.getByRole('button', { name: /confirm in desktop/i })).toBeDefined();
    expect(screen.getByText('Required')).toBeDefined();
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

    expect(screen.getByText('Up to date')).toBeDefined();
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
