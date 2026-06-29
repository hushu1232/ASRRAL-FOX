/**
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import PetDesktopStatusChip from '@/components/pet/sync/PetDesktopStatusChip';
import type { DesktopSyncStatus } from '@/lib/webbridge/sync-status';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const keys: Record<string, string> = {
      'preview.desktopStatusTip':
        'The Web preview may differ until the desktop pet reports the latest applied version.',
      'syncStatus.summary.upToDate': 'Up to date',
      'syncStatus.summary.failed': 'Sync failed',
      'syncStatus.summary.pendingPull': 'Pending pull',
      'syncStatus.summary.unknown': 'Unknown',
      'syncStatus.previewChip.upToDate': 'Synced',
      'syncStatus.previewChip.failed': 'Sync failed',
      'syncStatus.previewChip.pendingPull': 'Pending pull',
      'syncStatus.previewChip.localConfirmationRequired': 'Confirm locally',
      'syncStatus.previewChip.desktopOffline': 'Offline',
      'syncStatus.previewChip.unknown': 'Unknown',
    };
    return keys[key] ?? key;
  },
}));

jest.mock('antd', () => ({
  Tag: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Tooltip: ({ title, children }: { title: React.ReactNode; children: React.ReactNode }) => (
    <span>
      <span>{title}</span>
      {children}
    </span>
  ),
}));

jest.mock('@ant-design/icons', () => ({
  CheckCircleOutlined: () => null,
  ClockCircleOutlined: () => null,
  ExclamationCircleOutlined: () => null,
}));

function createStatus(overrides: Partial<DesktopSyncStatus> = {}): DesktopSyncStatus {
  return {
    desktopConnection: 'online',
    packageState: 'published',
    summaryKind: 'pendingPull',
    primaryAction: 'checkAgain',
    isUpToDate: false,
    webConfigVersion: 2,
    desktopKnownVersion: 1,
    desktopAppliedVersion: 1,
    requiresLocalConfirmation: false,
    lastSyncAt: '2026-06-27T08:00:00.000Z',
    lastAppliedAt: null,
    lastError: null,
    errorMessage: null,
    milestones: [],
    ...overrides,
  };
}

describe('PetDesktopStatusChip', () => {
  it('shows preview caveat that Web preview can differ from desktop-applied state', () => {
    render(<PetDesktopStatusChip status={createStatus()} />);

    expect(
      screen.getByText(
        'The Web preview may differ until the desktop pet reports the latest applied version.'
      )
    ).toBeDefined();
    expect(screen.getByText('Pending pull')).toBeDefined();
  });

  it('uses compact labels for preview states', () => {
    render(
      <div>
        <PetDesktopStatusChip status={createStatus({ summaryKind: 'pendingPull' })} />
        <PetDesktopStatusChip
          status={createStatus({
            packageState: 'staged',
            summaryKind: 'localConfirmationRequired',
            primaryAction: 'confirmInDesktop',
            requiresLocalConfirmation: true,
          })}
        />
        <PetDesktopStatusChip
          status={createStatus({
            packageState: 'applied',
            summaryKind: 'upToDate',
            primaryAction: 'none',
            isUpToDate: true,
          })}
        />
      </div>
    );

    expect(screen.getByText('Pending pull')).toBeDefined();
    expect(screen.getByText('Confirm locally')).toBeDefined();
    expect(screen.getByText('Synced')).toBeDefined();
  });

  it('shows offline as a compact state when Alife .NET has not reported recently', () => {
    render(
      <PetDesktopStatusChip
        status={createStatus({
          desktopConnection: 'offline',
          summaryKind: 'desktopOffline',
          primaryAction: 'checkAgain',
        })}
      />
    );

    expect(screen.getByText('Offline')).toBeDefined();
  });
});
