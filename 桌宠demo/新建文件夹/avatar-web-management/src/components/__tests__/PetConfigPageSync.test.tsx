/**
 * @jest-environment jsdom
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import type { ReactNode } from 'react';
import type { DesktopSyncStatus } from '@/lib/webbridge/sync-status';

const mockApiGet = jest.fn();
const mockApiPut = jest.fn();
const mockApiPost = jest.fn();

jest.mock('antd', () => {
  const actual = jest.requireActual('antd');
  return {
    ...actual,
    message: {
      success: jest.fn(),
      error: jest.fn(),
    },
  };
});

jest.mock('@/lib/api-client', () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
  apiPut: (...args: unknown[]) => mockApiPut(...args),
  apiPost: (...args: unknown[]) => mockApiPost(...args),
}));

jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    const messages: Record<string, Record<string, string>> = {
      'pet.diagnostics': {
        title: 'Diagnostics and package simulation',
        description:
          'Simulation tools are hidden by default so live Alife .NET status stays first.',
        show: 'Show diagnostics',
        hide: 'Hide diagnostics',
      },
    };

    const t = (key: string) => messages[namespace]?.[key] ?? key;
    t.rich = (key: string) => key;
    return t;
  },
}));

jest.mock('@/components/pet/sync/PetSyncStatusPanel', () => ({
  __esModule: true,
  default: ({
    status,
    loading,
    onRefresh,
  }: {
    status: DesktopSyncStatus | null;
    loading: boolean;
    onRefresh: () => void;
  }) => (
    <section data-testid="pet-sync-status-panel">
      <span data-testid="sync-status-summary">
        {loading ? 'loading' : (status?.summaryKind ?? 'empty')}
      </span>
      <button type="button" onClick={onRefresh}>
        refresh-sync
      </button>
    </section>
  ),
}));

jest.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/pet',
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const PetConfigPage = require('@/app/(auth)/dashboard/pet/page').default;

function Wrapper({ children }: { children: ReactNode }) {
  return <App>{children}</App>;
}

const petConfig = {
  id: 'pet-1',
  pet_name: 'Nova',
  personality: 'Curious',
  backstory: 'Built for sync tests',
  animation_model: 'live2d',
  avatar_id: 'avatar-1',
  ffmpeg_path: 'C:\\ffmpeg\\bin\\ffmpeg.exe',
  idle_timeout: 300,
  wander_interval: 30,
};

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

function mockSuccessfulApis(status: DesktopSyncStatus = createStatus()) {
  mockApiGet.mockImplementation(async (url: string) => {
    if (url === '/api/pet/config') {
      return { success: true, data: petConfig };
    }

    if (url === '/api/pet/sync/status') {
      return { success: true, data: status };
    }

    return { success: false, error: `Unexpected GET ${url}` };
  });
  mockApiPut.mockResolvedValue({ success: true, data: petConfig });
}

async function flushPageEffects() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSuccessfulApis();
});

describe('PetConfigPage desktop sync', () => {
  it('renders desktop sync panel after config loads', async () => {
    render(<PetConfigPage />, { wrapper: Wrapper });
    await flushPageEffects();

    await waitFor(() => {
      expect(screen.getByTestId('sync-status-summary').textContent).toBe('pendingPull');
    });

    expect(mockApiGet).toHaveBeenCalledWith('/api/pet/config');
    expect(mockApiGet).toHaveBeenCalledWith('/api/pet/sync/status');
    expect(mockApiGet.mock.calls.findIndex(([url]) => url === '/api/pet/config')).toBeLessThan(
      mockApiGet.mock.calls.findIndex(([url]) => url === '/api/pet/sync/status'),
    );
    const syncStatusPanel = screen.getByTestId('pet-sync-status-panel');
    expect(syncStatusPanel).toBeDefined();
    expect(screen.getByText('wizard.title')).toBeDefined();
    expect(screen.getByText('wizard.step5Desc')).toBeDefined();
    expect(screen.getByText('wizard.step6Desc')).toBeDefined();
    const runtimeSummaryTitle = screen.getByText('runtimeSummary.title');
    expect(runtimeSummaryTitle).toBeDefined();
    expect(screen.getByText('runtimeSummary.nextAction.label')).toBeDefined();
    expect(screen.getByText('preview.webPreview')).toBeDefined();
    expect(screen.getByText('Diagnostics and package simulation')).toBeDefined();
    const diagnosticsSection = screen.getByTestId('pet-diagnostics-section');
    expect(
      runtimeSummaryTitle.compareDocumentPosition(syncStatusPanel) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      syncStatusPanel.compareDocumentPosition(diagnosticsSection) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const showDiagnosticsButton = screen.getByRole('button', { name: /show diagnostics/i });
    expect(showDiagnosticsButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('WebBridge package simulation')).not.toBeInTheDocument();

    fireEvent.click(showDiagnosticsButton);

    expect(screen.getByRole('button', { name: /hide diagnostics/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByText('WebBridge package simulation')).toBeDefined();
    expect(screen.getByText('Alife .NET 9')).toBeDefined();
    expect(screen.getByText('No live Alife calls')).toBeDefined();
    expect(mockApiGet).toHaveBeenCalledTimes(2);
  });

  it('waits for first-run config creation before requesting desktop sync status', async () => {
    const calls: string[] = [];
    mockApiGet.mockImplementation(async (url: string) => {
      calls.push(url);
      if (url === '/api/pet/config') {
        await new Promise((resolve) => setTimeout(resolve, 30));
        return { success: true, data: petConfig };
      }

      if (url === '/api/pet/sync/status') {
        return { success: true, data: createStatus({ summaryKind: 'pendingPull' }) };
      }

      return { success: false, error: `Unexpected GET ${url}` };
    });

    render(<PetConfigPage />, { wrapper: Wrapper });
    await flushPageEffects();

    await waitFor(() => {
      expect(screen.getByTestId('sync-status-summary').textContent).toBe('pendingPull');
    });

    expect(calls).toEqual(['/api/pet/config', '/api/pet/sync/status']);
  });

  it('saving config calls apiPut and refreshes desktop sync status', async () => {
    render(<PetConfigPage />, { wrapper: Wrapper });
    await flushPageEffects();

    await waitFor(() => {
      expect(screen.getByTestId('sync-status-summary').textContent).toBe('pendingPull');
    });

    fireEvent.click(screen.getByRole('button', { name: /saveConfig/i }));

    await waitFor(() => {
      expect(mockApiPut).toHaveBeenCalledWith('/api/pet/config', {
        petName: 'Nova',
        personality: 'Curious',
        backstory: 'Built for sync tests',
      });
    });

    await waitFor(() => {
      expect(mockApiGet.mock.calls.filter(([url]) => url === '/api/pet/sync/status')).toHaveLength(
        2,
      );
    });
  });
});
