/**
 * @jest-environment jsdom
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import type { ReactNode } from 'react';
import type { AlifeLocalHealthView } from '@/lib/alife/local-health';
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

jest.mock('@/lib/use-api', () => {
  const React = jest.requireActual('react') as typeof import('react');

  return {
    useApiGet: (path: string | null) => {
      const [state, setState] = React.useState<{
        data?: unknown;
        error?: unknown;
        isLoading: boolean;
        isValidating: boolean;
      }>({ isLoading: Boolean(path), isValidating: false });

      React.useEffect(() => {
        if (!path) {
          setState({ isLoading: false, isValidating: false });
          return;
        }

        let active = true;
        setState(current => ({ ...current, isLoading: current.data === undefined }));
        void mockApiGet(path).then(
          (data: unknown) => {
            if (active) setState({ data, isLoading: false, isValidating: false });
          },
          (error: unknown) => {
            if (active) setState({ error, isLoading: false, isValidating: false });
          },
        );
        return () => { active = false; };
      }, [path]);

      const mutate = React.useCallback(async () => {
        if (!path) return undefined;
        setState(current => ({ ...current, isValidating: true }));
        try {
          const data = await mockApiGet(path);
          setState({ data, isLoading: false, isValidating: false });
          return data;
        } catch (error) {
          setState({ error, isLoading: false, isValidating: false });
          throw error;
        }
      }, [path]);

      return { ...state, mutate };
    },
  };
});

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
      'pet.webbridgeMock': {
        title: 'WebBridge package simulation',
        noLiveCalls: 'No live Alife calls',
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

jest.mock('@/components/pet/sync/PetSyncDiagnosticsPanel', () => ({
  __esModule: true,
  default: ({ status, loading }: { status: DesktopSyncStatus | null; loading: boolean }) => (
    <section data-testid="pet-sync-diagnostics-panel">
      <span>Live WebBridge diagnostics</span>
      <span data-testid="diagnostics-status-props">
        {loading ? 'loading' : status ? status.summaryKind : 'empty'}
      </span>
    </section>
  ),
}));

jest.mock('@/components/pet/sync/AlifeLocalHealthPanel', () => ({
  __esModule: true,
  default: ({
    health,
    loading,
    onRefresh,
  }: {
    health: AlifeLocalHealthView | null;
    loading: boolean;
    onRefresh: () => void;
  }) => (
    <section data-testid="alife-local-health-panel">
      <span data-testid="alife-local-health-props">
        {loading ? 'loading' : health ? `${health.state}:${health.reason ?? 'none'}` : 'empty'}
      </span>
      <button type="button" onClick={onRefresh}>
        refresh-alife-health
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

function createLocalHealth(overrides: Partial<AlifeLocalHealthView> = {}): AlifeLocalHealthView {
  return {
    state: 'reachable',
    configured: true,
    checkedAt: '2026-07-05T03:04:05.000Z',
    health: {
      status: 'healthy',
      service: 'alife-local',
      version: '1.2.3',
      timestampUtc: '2026-07-05T03:04:04.000Z',
    },
    runtime: {
      status: 'ready',
      agent: 'FoxAgent',
      qchatEnabled: true,
      visionEnabled: true,
      visionStatus: 'ready',
      visionReason: '',
      ttsEnabled: false,
      ttsStatus: 'notReady',
      ttsReason: 'voice model offline',
      outboxEnabled: true,
      timestampUtc: '2026-07-05T03:04:04.000Z',
    },
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

    if (url === '/api/pet/alife/local-health') {
      return { success: true, data: createLocalHealth() };
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
    expect(mockApiGet).toHaveBeenCalledWith('/api/pet/alife/local-health');
    const configCallIndex = mockApiGet.mock.calls.findIndex(([url]) => url === '/api/pet/config');
    const syncCallIndex = mockApiGet.mock.calls.findIndex(
      ([url]) => url === '/api/pet/sync/status',
    );
    const localHealthCallIndex = mockApiGet.mock.calls.findIndex(
      ([url]) => url === '/api/pet/alife/local-health',
    );
    expect(configCallIndex).toBeGreaterThanOrEqual(0);
    expect(syncCallIndex).toBeGreaterThanOrEqual(0);
    expect(localHealthCallIndex).toBeGreaterThanOrEqual(0);
    expect(configCallIndex).toBeLessThan(syncCallIndex);
    expect(configCallIndex).toBeLessThan(localHealthCallIndex);
    const runtimeSummaryTitle = screen.getByText('runtimeSummary.title');
    const syncStatusPanel = screen.getByTestId('pet-sync-status-panel');
    const alifeLocalHealthPanel = screen.getByTestId('alife-local-health-panel');
    expect(
      runtimeSummaryTitle.compareDocumentPosition(alifeLocalHealthPanel) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      alifeLocalHealthPanel.compareDocumentPosition(syncStatusPanel) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(syncStatusPanel).toBeDefined();
    expect(screen.getByTestId('alife-local-health-panel')).toBeDefined();
    expect(screen.getByTestId('alife-local-health-props').textContent).toBe('reachable:none');
    expect(screen.getByText('wizard.title')).toBeDefined();
    expect(screen.getByText('wizard.step5Desc')).toBeDefined();
    expect(screen.getByText('wizard.step6Desc')).toBeDefined();
    expect(runtimeSummaryTitle).toBeDefined();
    expect(screen.getByText('runtimeSummary.nextAction.label')).toBeDefined();
    const previewPanelTitle = screen.getByText('preview.webPreview');
    const editorBasicName = screen.getByText('basic.name');
    expect(previewPanelTitle).toBeDefined();
    expect(editorBasicName).toBeDefined();
    expect(screen.getByText('Diagnostics and package simulation')).toBeDefined();
    const diagnosticsSection = screen.getByTestId('pet-diagnostics-section');
    expect(
      runtimeSummaryTitle.compareDocumentPosition(syncStatusPanel) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      syncStatusPanel.compareDocumentPosition(previewPanelTitle) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      syncStatusPanel.compareDocumentPosition(editorBasicName) & Node.DOCUMENT_POSITION_FOLLOWING,
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
    const diagnosticsPanel = screen.getByTestId('pet-sync-diagnostics-panel');
    expect(diagnosticsPanel).toBeDefined();
    expect(screen.getByText('Live WebBridge diagnostics')).toBeDefined();
    expect(screen.getByTestId('diagnostics-status-props').textContent).toBe('pendingPull');
    expect(screen.queryByText('WebBridge package simulation')).not.toBeInTheDocument();
    expect(mockApiGet).toHaveBeenCalledTimes(3);
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

      if (url === '/api/pet/alife/local-health') {
        return { success: true, data: createLocalHealth() };
      }

      return { success: false, error: `Unexpected GET ${url}` };
    });

    render(<PetConfigPage />, { wrapper: Wrapper });
    await flushPageEffects();

    await waitFor(() => {
      expect(screen.getByTestId('sync-status-summary').textContent).toBe('pendingPull');
    });

    expect(calls).toContain('/api/pet/config');
    expect(calls).toContain('/api/pet/sync/status');
    expect(calls).toContain('/api/pet/alife/local-health');
    expect(calls.indexOf('/api/pet/config')).toBeLessThan(calls.indexOf('/api/pet/sync/status'));
    expect(calls.indexOf('/api/pet/config')).toBeLessThan(
      calls.indexOf('/api/pet/alife/local-health'),
    );
  });

  it('maps failed local health requests to an advisory dashboard error state', async () => {
    mockApiGet.mockImplementation(async (url: string) => {
      if (url === '/api/pet/config') {
        return { success: true, data: petConfig };
      }

      if (url === '/api/pet/sync/status') {
        return { success: true, data: createStatus({ summaryKind: 'pendingPull' }) };
      }

      if (url === '/api/pet/alife/local-health') {
        return { success: false, error: 'raw server detail with secret-token' };
      }

      return { success: false, error: `Unexpected GET ${url}` };
    });

    render(<PetConfigPage />, { wrapper: Wrapper });
    await flushPageEffects();

    await waitFor(() => {
      expect(screen.getByTestId('alife-local-health-props').textContent).toBe(
        'error:apiRequestFailed',
      );
    });
    expect(screen.queryByText(/raw server detail/)).toBeNull();
    expect(screen.queryByText(/secret-token/)).toBeNull();
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
