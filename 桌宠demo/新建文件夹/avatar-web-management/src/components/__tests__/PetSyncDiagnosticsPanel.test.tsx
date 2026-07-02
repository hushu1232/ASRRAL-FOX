/**
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { App } from 'antd';
import type { ReactNode } from 'react';
import PetSyncDiagnosticsPanel from '@/components/pet/sync/PetSyncDiagnosticsPanel';
import type { DesktopSyncStatus } from '@/lib/webbridge/sync-status';

const messages: Record<string, Record<string, string>> = {
  'pet.syncDiagnostics': {
    title: 'Live WebBridge diagnostics',
    loading: 'Checking live diagnostic evidence...',
    unavailable: 'Live WebBridge diagnostics are unavailable.',
    liveData: 'Live data',
    integrationSnapshot: 'Integration snapshot',
    blockingReason: 'Blocking reason',
    evidenceTrail: 'Evidence trail',
    smokeMapping: 'Smoke mapping',
    webPackageVersion: 'Web package version',
    desktopKnownVersion: 'Alife known version',
    desktopAppliedVersion: 'Alife applied version',
    packageState: 'Package state',
    desktopConnection: 'Desktop connection',
    localConfirmation: 'Local confirmation',
    notReported: 'Not reported',
    never: 'never',
    lastSyncAt: 'Last sync',
    lastAppliedAt: 'Last applied',
    milestones: 'Milestones',
    errorDetails: 'Error details',
    noMilestones: 'No milestones reported yet.',
    noLiveError: 'No live error reported.',
    'versionAlignment.missingEvidence': 'Alife .NET has not reported enough version evidence.',
    'versionAlignment.notPulled':
      'Web package is newer; Alife .NET has not pulled the newest package.',
    'versionAlignment.knownButNotApplied':
      'Alife .NET knows the newest package but has not applied it.',
    'versionAlignment.current': 'Alife .NET is running the current Web package.',
    'blocking.unknown': 'Waiting for complete WebBridge status evidence.',
    'blocking.desktopOffline': 'Waiting for Alife .NET to reconnect.',
    'blocking.pendingPull': 'Waiting for Alife .NET to pull the Web package.',
    'blocking.localConfirmationRequired':
      'Waiting for local confirmation inside Alife .NET.',
    'blocking.upToDate': 'No blocking sync reason reported.',
    'blocking.failed': 'Waiting for the live WebBridge sync error to be resolved.',
    'smoke.stagedMapping': 'Staged/local confirmation mapping',
    'smoke.appliedMapping': 'Applied/up-to-date mapping',
    'smoke.commandLabel': 'Smoke command',
    'smoke.readOnly': 'Read-only reference',
    'smoke.stagedValue': 'WebStatus: staged/localConfirmationRequired/confirmInDesktop',
    'smoke.appliedValue':
      'WebStatus: applied/upToDate/none/requiresLocalConfirmation=false',
    'smoke.command':
      "$env:DOTNET_EXE='C:\\Users\\hu shu\\.dotnet\\dotnet.exe'; $env:ALIFE_ROOT='D:\\Alife'; npm run check:webbridge:smoke",
  },
  'pet.syncStatus': {
    required: 'Required',
    notRequired: 'Not required',
    'connectionState.unknown': 'Unknown',
    'connectionState.checking': 'Checking',
    'connectionState.online': 'Online',
    'connectionState.offline': 'Offline',
    'packageStateLabel.notPublished': 'Not published',
    'packageStateLabel.published': 'Published, waiting for pull',
    'packageStateLabel.pulled': 'Pulled by Alife .NET',
    'packageStateLabel.staged': 'Staged locally',
    'packageStateLabel.applied': 'Applied in Alife .NET',
    'packageStateLabel.failed': 'Package failed',
  },
};

jest.mock('@ant-design/icons', () => ({
  ApiOutlined: () => <span data-testid="icon-api" />,
}));

jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => messages[namespace]?.[key] ?? key,
}));

function Wrapper({ children }: { children: ReactNode }) {
  return <App>{children}</App>;
}

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

describe('PetSyncDiagnosticsPanel', () => {
  it('shows pending-pull diagnostic evidence and read-only smoke mapping', () => {
    render(<PetSyncDiagnosticsPanel status={createStatus()} loading={false} />, {
      wrapper: Wrapper,
    });

    expect(screen.getByTestId('pet-sync-diagnostics-panel')).toBeDefined();
    expect(screen.getByText('Live WebBridge diagnostics')).toBeDefined();
    expect(screen.getByText('Live data')).toBeDefined();
    expect(screen.getByText('Integration snapshot')).toBeDefined();
    expect(screen.getByText('Web package version')).toBeDefined();
    expect(screen.getByText('Alife known version')).toBeDefined();
    expect(screen.getByText('Alife applied version')).toBeDefined();
    expect(screen.getByText('Published, waiting for pull')).toBeDefined();
    expect(screen.getByText('Online')).toBeDefined();
    expect(screen.getByText('Not required')).toBeDefined();
    expect(
      screen.getByText('Web package is newer; Alife .NET has not pulled the newest package.'),
    ).toBeDefined();
    expect(screen.getByText('Blocking reason')).toBeDefined();
    expect(screen.getByText('Waiting for Alife .NET to pull the Web package.')).toBeDefined();
    expect(screen.getByText('Evidence trail')).toBeDefined();
    expect(screen.getByText('No milestones reported yet.')).toBeDefined();
    expect(screen.getByText('No live error reported.')).toBeDefined();
    expect(screen.getByText('Smoke mapping')).toBeDefined();
    expect(
      screen.getByText('WebStatus: staged/localConfirmationRequired/confirmInDesktop'),
    ).toBeDefined();
    expect(
      screen.getByText('WebStatus: applied/upToDate/none/requiresLocalConfirmation=false'),
    ).toBeDefined();
    expect(
      screen.getByText(
        "$env:DOTNET_EXE='C:\\Users\\hu shu\\.dotnet\\dotnet.exe'; $env:ALIFE_ROOT='D:\\Alife'; npm run check:webbridge:smoke",
      ),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: /smoke/i })).toBeNull();
  });

  it('shows loading and unavailable states without inventing diagnostic values', () => {
    const { rerender } = render(<PetSyncDiagnosticsPanel status={null} loading />, {
      wrapper: Wrapper,
    });

    expect(screen.getByText('Checking live diagnostic evidence...')).toBeDefined();
    expect(screen.queryByText('Integration snapshot')).toBeNull();

    rerender(<PetSyncDiagnosticsPanel status={null} loading={false} />);

    expect(screen.getByText('Live WebBridge diagnostics are unavailable.')).toBeDefined();
    expect(screen.queryByText('Integration snapshot')).toBeNull();
  });
});
