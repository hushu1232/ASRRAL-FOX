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
  useTranslations: () => {
    const t = (key: string) => key;
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
