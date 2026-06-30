/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { App } from 'antd';
import PetRuntimeSummary from '@/components/pet/PetRuntimeSummary';
import type { DesktopSyncStatus } from '@/lib/webbridge/sync-status';
import type { ReactNode } from 'react';

const messages: Record<string, Record<string, string>> = {
  pet: {
    'runtimeSummary.title': 'Runtime status',
    'runtimeSummary.unavailable':
      'Runtime sync status is unavailable. Check again after the web service is ready.',
    'runtimeSummary.currentState': 'Current state',
    'runtimeSummary.commandTitle': 'WebBridge command strip',
    'runtimeSummary.commandDescription': 'Track Web package state against Alife .NET 9.',
    'runtimeSummary.nextAction.label': 'Next action',
    'runtimeSummary.nextAction.none': 'No action required',
    'runtimeSummary.nextAction.checkAgain': 'Check Alife .NET runtime status again',
    'runtimeSummary.nextAction.openDesktop': 'Open Alife .NET runtime',
    'runtimeSummary.nextAction.confirmInDesktop':
      'Confirm the staged package inside Alife .NET',
    'runtimeSummary.nextAction.viewDetails': 'Review sync details before retrying',
  },
  'pet.syncStatus': {
    webVersion: 'Web version',
    desktopKnownVersion: 'Alife known version',
    desktopAppliedVersion: 'Alife applied version',
    localConfirmation: 'Local confirmation',
    required: 'Required',
    notRequired: 'Not required',
    notApplied: 'Not applied',
    lastSyncAt: 'Last sync',
    never: 'Never',
    'action.checkAgain': 'Check again',
    'action.confirmInDesktop': 'Confirm in Alife .NET',
    'action.openDesktop': 'Open Alife .NET',
    'action.viewDetails': 'View details',
    'actionHint.confirmInDesktop':
      'Confirm the staged package inside Alife .NET. Web activation is not available.',
    'actionHint.openDesktop': 'Open Alife .NET locally, then check again from Web.',
    'summary.pendingPull': 'Waiting for Alife .NET pull',
    'summary.localConfirmationRequired': 'Awaiting local confirmation',
    'summary.upToDate': 'Applied in Alife .NET',
    'summary.desktopOffline': 'Alife .NET offline',
    'summary.failed': 'Sync failed',
    'summary.unknown': 'Unknown',
    'detail.pendingPull': 'Web has a newer package waiting for Alife .NET to pull.',
    'detail.localConfirmationRequired':
      'Package staged locally. Confirm it in Alife .NET before apply.',
    'detail.upToDate': 'Alife .NET is running the current Web version.',
    'detail.desktopOffline': 'Alife .NET is offline or has not reported recently.',
    'detail.failed': 'Review the sync error before retrying.',
    'detail.unknown': 'Status is incomplete. Check again after Alife .NET reports.',
  },
};

jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => messages[namespace]?.[key] ?? key,
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
    webConfigVersion: 12,
    desktopKnownVersion: 12,
    desktopAppliedVersion: 11,
    requiresLocalConfirmation: true,
    lastSyncAt: '2026-06-27T08:00:00.000Z',
    lastAppliedAt: null,
    lastError: null,
    errorMessage: null,
    milestones: [],
    ...overrides,
  };
}

function expectVisibleGuidanceText(node: HTMLElement) {
  expect(node).toBeVisible();
  expect(node).not.toHaveStyle({ position: 'absolute' });
}

describe('PetRuntimeSummary', () => {
  it('renders a sync command strip with an emphasized next action', () => {
    render(<PetRuntimeSummary status={createStatus()} loading={false} onRefresh={jest.fn()} />, {
      wrapper: Wrapper,
    });

    expect(screen.getByTestId('sync-command-strip')).toBeDefined();
    expect(screen.getByText('WebBridge command strip')).toBeDefined();
    expect(screen.getByText('Track Web package state against Alife .NET 9.')).toBeDefined();
    expect(screen.getByTestId('sync-next-action').textContent).toContain(
      'Confirm the staged package inside Alife .NET',
    );
  });

  it('shows a disabled local confirmation action because confirmation happens in Alife .NET', () => {
    render(<PetRuntimeSummary status={createStatus()} loading={false} onRefresh={jest.fn()} />, {
      wrapper: Wrapper,
    });

    const confirmButton = screen.getByRole('button', { name: 'Confirm in Alife .NET' });
    const confirmGuidance = screen.getByText(
      'Confirm the staged package inside Alife .NET. Web activation is not available.',
    );
    expect(confirmButton).toBeDisabled();
    expect(confirmButton).toHaveAccessibleDescription(
      'Confirm the staged package inside Alife .NET. Web activation is not available.',
    );
    expect(screen.getByTestId('icon-desktop')).toBeDefined();
    expectVisibleGuidanceText(confirmGuidance);
  });

  it('shows an Alife .NET open guidance action for openDesktop state', () => {
    render(
      <PetRuntimeSummary
        status={createStatus({
          primaryAction: 'openDesktop',
          summaryKind: 'desktopOffline',
          desktopConnection: 'offline',
        })}
        loading={false}
        onRefresh={jest.fn()}
      />,
      { wrapper: Wrapper },
    );

    const openButton = screen.getByRole('button', { name: 'Open Alife .NET' });
    const openGuidance = screen.getByText('Open Alife .NET locally, then check again from Web.');
    expect(openButton).toBeDisabled();
    expect(openButton).toHaveAccessibleDescription(
      'Open Alife .NET locally, then check again from Web.',
    );
    expect(screen.getByTestId('icon-desktop')).toBeDefined();
    expectVisibleGuidanceText(openGuidance);
    expect(screen.getByTestId('sync-next-action').textContent).toContain(
      'Open Alife .NET runtime',
    );
  });

  it('does not render a primary action button for viewDetails', () => {
    render(
      <PetRuntimeSummary
        status={createStatus({ primaryAction: 'viewDetails', summaryKind: 'failed' })}
        loading={false}
        onRefresh={jest.fn()}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.queryByRole('button', { name: 'View details' })).toBeNull();
  });

  it('surfaces current state, next action, versions, and local confirmation guard', () => {
    render(<PetRuntimeSummary status={createStatus()} loading={false} onRefresh={jest.fn()} />, {
      wrapper: Wrapper,
    });

    expect(screen.getByText('Runtime status')).toBeDefined();
    expect(screen.getByText('Awaiting local confirmation')).toBeDefined();
    expect(
      screen.getByText('Package staged locally. Confirm it in Alife .NET before apply.'),
    ).toBeDefined();
    expect(screen.getByText('Confirm the staged package inside Alife .NET')).toBeDefined();
    expect(screen.getByText('Web version')).toBeDefined();
    expect(screen.getByText('Alife known version')).toBeDefined();
    expect(screen.getAllByText('12')).toHaveLength(2);
    expect(screen.getByText('Alife applied version')).toBeDefined();
    expect(screen.getByText('11')).toBeDefined();
    expect(screen.getByText('Local confirmation')).toBeDefined();
    expect(screen.getByText('Required')).toBeDefined();
  });

  it('pendingPull explains that Alife .NET must pull the Web package', () => {
    render(
      <PetRuntimeSummary
        status={createStatus({
          packageState: 'published',
          summaryKind: 'pendingPull',
          primaryAction: 'checkAgain',
          desktopKnownVersion: 11,
          desktopAppliedVersion: 11,
          requiresLocalConfirmation: false,
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
    expect(screen.getByText('Check Alife .NET runtime status again')).toBeDefined();
  });

  it('upToDate explains that Alife .NET applied the current Web version', () => {
    render(
      <PetRuntimeSummary
        status={createStatus({
          packageState: 'applied',
          summaryKind: 'upToDate',
          primaryAction: 'none',
          isUpToDate: true,
          desktopKnownVersion: 12,
          desktopAppliedVersion: 12,
          requiresLocalConfirmation: false,
        })}
        loading={false}
        onRefresh={jest.fn()}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByText('Applied in Alife .NET')).toBeDefined();
    expect(screen.getByText('Alife .NET is running the current Web version.')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Check again' })).toBeNull();
  });

  it('offers check-again action when the primary action is refreshable', () => {
    const onRefresh = jest.fn();
    render(
      <PetRuntimeSummary
        status={createStatus({ primaryAction: 'checkAgain', summaryKind: 'desktopOffline' })}
        loading={false}
        onRefresh={onRefresh}
      />,
      { wrapper: Wrapper },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('shows an unavailable summary when status is missing', () => {
    render(<PetRuntimeSummary status={null} loading={false} onRefresh={jest.fn()} />, {
      wrapper: Wrapper,
    });

    expect(
      screen.getByText(
        'Runtime sync status is unavailable. Check again after the web service is ready.',
      ),
    ).toBeDefined();
  });
});
