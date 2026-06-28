/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { App } from 'antd';
import PetRuntimeSummary from '@/components/pet/PetRuntimeSummary';
import type { DesktopSyncStatus } from '@/lib/webbridge/sync-status';
import type { ReactNode } from 'react';

jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) =>
    namespace === 'pet.syncStatus' ? `syncStatus.${key}` : key,
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

describe('PetRuntimeSummary', () => {
  it('surfaces current state, next action, versions, and local confirmation guard', () => {
    render(<PetRuntimeSummary status={createStatus()} loading={false} onRefresh={jest.fn()} />, {
      wrapper: Wrapper,
    });

    expect(screen.getByText('runtimeSummary.title')).toBeDefined();
    expect(screen.getByText('syncStatus.summary.localConfirmationRequired')).toBeDefined();
    expect(screen.getByText('runtimeSummary.nextAction.confirmInDesktop')).toBeDefined();
    expect(screen.getByText('12')).toBeDefined();
    expect(screen.getByText('11')).toBeDefined();
    expect(screen.getByText('syncStatus.required')).toBeDefined();
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

    fireEvent.click(screen.getByRole('button', { name: 'syncStatus.action.checkAgain' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('shows an unavailable summary when status is missing', () => {
    render(<PetRuntimeSummary status={null} loading={false} onRefresh={jest.fn()} />, {
      wrapper: Wrapper,
    });

    expect(screen.getByText('runtimeSummary.unavailable')).toBeDefined();
  });
});
