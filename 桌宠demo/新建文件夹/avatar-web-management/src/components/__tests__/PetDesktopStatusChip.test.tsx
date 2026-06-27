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
});
