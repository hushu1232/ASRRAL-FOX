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
    webVersion: 'Web package version',
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
    errorTitle: 'Error title',
    recovery: 'Recovery',
    technicalDetail: 'Technical detail',
    required: 'Required',
    notRequired: 'Not required',
    noMilestones: 'No milestones reported yet.',
    noLiveError: 'No live error reported.',
    'versionAlignment.missingEvidence':
      'Alife .NET has not reported enough version evidence yet.',
    'versionAlignment.notPulled':
      'Web package is newer; Alife .NET has not pulled the newest package.',
    'versionAlignment.knownButNotApplied':
      'Alife .NET knows or staged the package but has not applied it.',
    'versionAlignment.current': 'Alife .NET has applied the current Web package version.',
    'blocking.unknown': 'Status is incomplete; wait for Alife .NET to report again.',
    'blocking.desktopOffline': 'Alife .NET is offline or has not reported recently.',
    'blocking.pendingPull': 'Waiting for Alife .NET to pull the Web package.',
    'blocking.localConfirmationRequired':
      'Package is staged locally and must be confirmed inside Alife .NET.',
    'blocking.upToDate': 'Package is applied and current; no blocking reason.',
    'blocking.failed': 'Package sync failed; inspect error details before retrying.',
    'smoke.expectedStagedLabel': 'Staged/local confirmation mapping',
    'smoke.expectedAppliedLabel': 'Applied/up-to-date mapping',
    'smoke.commandLabel': 'Smoke command',
    'smoke.readOnly': 'Read-only reference',
    'smoke.expectedStaged': 'WebStatus: staged/localConfirmationRequired/confirmInDesktop',
    'smoke.expectedApplied':
      'WebStatus: applied/upToDate/none/requiresLocalConfirmation=false',
    'smoke.command':
      "$env:DOTNET_EXE='C:\\Users\\hu shu\\.dotnet\\dotnet.exe'; $env:ALIFE_ROOT='D:\\Alife'; npm run check:webbridge:smoke",
  },
  'pet.syncStatus': {
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
    expect(screen.getByText('Staged/local confirmation mapping')).toBeDefined();
    expect(
      screen.getByText('WebStatus: staged/localConfirmationRequired/confirmInDesktop'),
    ).toBeDefined();
    expect(screen.getByText('Applied/up-to-date mapping')).toBeDefined();
    expect(
      screen.getByText('WebStatus: applied/upToDate/none/requiresLocalConfirmation=false'),
    ).toBeDefined();
    expect(screen.getByText('Smoke command')).toBeDefined();
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

  it('shows local confirmation required status evidence', () => {
    render(
      <PetSyncDiagnosticsPanel
        status={createStatus({
          packageState: 'staged',
          summaryKind: 'localConfirmationRequired',
          primaryAction: 'confirmInDesktop',
          webConfigVersion: 7,
          desktopKnownVersion: 7,
          desktopAppliedVersion: 6,
          requiresLocalConfirmation: true,
          milestones: [
            'manifestFetched',
            'filesDownloaded',
            'hashValidated',
            'packageStaged',
          ],
        })}
        loading={false}
      />,
      { wrapper: Wrapper },
    );

    expect(
      screen.getByText('Alife .NET knows or staged the package but has not applied it.'),
    ).toBeDefined();
    expect(
      screen.getByText('Package is staged locally and must be confirmed inside Alife .NET.'),
    ).toBeDefined();
    expect(screen.getByText('Required')).toBeDefined();
    expect(screen.getByText('Staged locally')).toBeDefined();
    expect(screen.getByText('manifestFetched')).toBeDefined();
    expect(screen.getByText('packageStaged')).toBeDefined();
  });

  it('shows failed status with live error evidence and recovery guidance', () => {
    render(
      <PetSyncDiagnosticsPanel
        status={createStatus({
          packageState: 'failed',
          summaryKind: 'failed',
          primaryAction: 'viewDetails',
          lastError: {
            code: 'PACKAGE_HASH_MISMATCH',
            message: 'Package validation failed',
            technicalDetail: 'Expected sha256 abc but received def',
          },
          errorMessage: {
            title: 'Package validation failed',
            recovery: 'Re-download the package from the Web management app.',
          },
          milestones: ['manifestFetched', 'filesDownloaded', 'packageFailed'],
        })}
        loading={false}
      />,
      { wrapper: Wrapper },
    );

    expect(
      screen.getByText('Package sync failed; inspect error details before retrying.'),
    ).toBeDefined();
    expect(screen.getByText('PACKAGE_HASH_MISMATCH')).toBeDefined();
    expect(screen.getAllByText(/Package validation failed/).length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText('Recovery: Re-download the package from the Web management app.'),
    ).toBeDefined();
    expect(screen.getByText('Technical detail: Expected sha256 abc but received def')).toBeDefined();
    expect(screen.getByText('packageFailed')).toBeDefined();
  });

  it('shows up-to-date status evidence without a blocking reason', () => {
    render(
      <PetSyncDiagnosticsPanel
        status={createStatus({
          packageState: 'applied',
          summaryKind: 'upToDate',
          primaryAction: 'none',
          isUpToDate: true,
          webConfigVersion: 9,
          desktopKnownVersion: 9,
          desktopAppliedVersion: 9,
          requiresLocalConfirmation: false,
          lastAppliedAt: '2026-06-27T08:10:00.000Z',
          milestones: [
            'manifestFetched',
            'filesDownloaded',
            'hashValidated',
            'packageApplied',
          ],
        })}
        loading={false}
      />,
      { wrapper: Wrapper },
    );

    expect(
      screen.getByText('Alife .NET has applied the current Web package version.'),
    ).toBeDefined();
    expect(screen.getByText('Package is applied and current; no blocking reason.')).toBeDefined();
    expect(screen.getByText('Applied in Alife .NET')).toBeDefined();
    expect(screen.getByText('packageApplied')).toBeDefined();
  });

  it('shows offline and unknown status evidence', () => {
    const { rerender } = render(
      <PetSyncDiagnosticsPanel
        status={createStatus({
          desktopConnection: 'offline',
          summaryKind: 'desktopOffline',
          desktopKnownVersion: null,
          desktopAppliedVersion: null,
        })}
        loading={false}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByText('Alife .NET is offline or has not reported recently.')).toBeDefined();
    expect(
      screen.getByText('Alife .NET has not reported enough version evidence yet.'),
    ).toBeDefined();
    expect(screen.getAllByText('Not reported').length).toBeGreaterThanOrEqual(2);

    rerender(
      <PetSyncDiagnosticsPanel
        status={createStatus({
          desktopConnection: 'unknown',
          packageState: 'notPublished',
          summaryKind: 'unknown',
          desktopKnownVersion: null,
          desktopAppliedVersion: null,
        })}
        loading={false}
      />,
    );

    expect(
      screen.getByText('Status is incomplete; wait for Alife .NET to report again.'),
    ).toBeDefined();
    expect(screen.getByText('Unknown')).toBeDefined();
    expect(screen.getByText('Not published')).toBeDefined();
  });
});
