/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { App } from 'antd';
import type { ReactNode } from 'react';
import AlifeLocalHealthPanel from '@/components/pet/sync/AlifeLocalHealthPanel';
import type { AlifeLocalHealthState, AlifeLocalHealthView } from '@/lib/alife/local-health';

const messages: Record<string, Record<string, string>> = {
  'pet.alifeLocalHealth': {
    title: 'Alife local health',
    source: 'Local API',
    loading: 'Checking Alife local health...',
    advisory: 'Advisory only. Web cannot start, stop, restart, or apply Alife runtime changes.',
    refresh: 'Check local health',
    notReported: 'Not reported',
    agent: 'Agent',
    version: 'Version',
    qchat: 'QChat',
    vision: 'Vision',
    tts: 'TTS',
    outbox: 'Outbox',
    lastChecked: 'Last checked',
    enabled: 'Enabled',
    disabled: 'Disabled',
    ready: 'Ready',
    notReady: 'Not ready',
    reason: 'Reason',
    'state.notConfigured': 'Not configured',
    'state.reachable': 'Reachable',
    'state.unreachable': 'Unreachable',
    'state.authRequired': 'Auth required',
    'state.invalidResponse': 'Invalid response',
    'state.error': 'Error',
    'description.notConfigured': 'Local Alife health checks are not configured for this server.',
    'description.reachable': 'The sanitized Alife local health endpoint is reachable.',
    'description.unreachable': 'The local Alife health endpoint could not be reached.',
    'description.authRequired': 'The local Alife health endpoint requires server-side auth.',
    'description.invalidResponse': 'The local Alife health endpoint returned unexpected data.',
    'description.error': 'The local Alife health check failed before it could read runtime data.',
  },
};

const localBaseUrl = ['http://127.0.0.1', '8787'].join(':');

jest.mock('@ant-design/icons', () => ({
  ApiOutlined: () => <span data-testid="icon-api" />,
  ReloadOutlined: () => <span data-testid="icon-reload" />,
}));

jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => messages[namespace]?.[key] ?? key,
}));

function Wrapper({ children }: { children: ReactNode }) {
  return <App>{children}</App>;
}

function createReachableHealth(
  overrides: Partial<AlifeLocalHealthView> = {},
): AlifeLocalHealthView {
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

function createStateHealth(state: AlifeLocalHealthState, reason: string): AlifeLocalHealthView {
  return {
    state,
    configured: state !== 'notConfigured',
    checkedAt: '2026-07-05T03:04:05.000Z',
    reason,
  };
}

type SensitiveHealthFixture = AlifeLocalHealthView & {
  ownerId: string;
  botId: string;
  token: string;
  baseUrl: string;
};

describe('AlifeLocalHealthPanel', () => {
  it('renders reachable sanitized health with labels, values, status, source, and advisory copy', () => {
    const health: SensitiveHealthFixture = {
      ...createReachableHealth(),
      ownerId: '3045846738',
      botId: '2905391496',
      token: 'secret-token',
      baseUrl: localBaseUrl,
    };

    const { container } = render(
      <AlifeLocalHealthPanel health={health} loading={false} onRefresh={jest.fn()} />,
      { wrapper: Wrapper },
    );

    expect(screen.getByText('Alife local health')).toBeDefined();
    expect(screen.getByText('Local API')).toBeDefined();
    expect(screen.getByText('Reachable')).toBeDefined();
    expect(
      screen.getByText('The sanitized Alife local health endpoint is reachable.'),
    ).toBeDefined();
    expect(
      screen.getByText(
        'Advisory only. Web cannot start, stop, restart, or apply Alife runtime changes.',
      ),
    ).toBeDefined();
    expect(screen.getByText('Agent')).toBeDefined();
    expect(screen.getByText('FoxAgent')).toBeDefined();
    expect(screen.getByText('Version')).toBeDefined();
    expect(screen.getByText('1.2.3')).toBeDefined();
    expect(screen.getByText('QChat')).toBeDefined();
    expect(screen.getAllByText('Enabled').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Vision')).toBeDefined();
    expect(screen.getByText('Ready')).toBeDefined();
    expect(screen.getByText('TTS')).toBeDefined();
    expect(screen.getByText(/voice model offline/)).toBeDefined();
    expect(screen.getByText('Outbox')).toBeDefined();
    expect(screen.getByText('Last checked')).toBeDefined();

    expect(container.textContent).not.toContain('3045846738');
    expect(container.textContent).not.toContain('2905391496');
    expect(container.textContent).not.toContain('secret-token');
    expect(container.textContent).not.toContain(localBaseUrl);
  });

  it('does not render management action buttons', () => {
    render(
      <AlifeLocalHealthPanel
        health={createReachableHealth()}
        loading={false}
        onRefresh={jest.fn()}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.queryByRole('button', { name: /^start$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^stop$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^restart$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^apply$/i })).toBeNull();
  });

  it('calls onRefresh from the refresh button', () => {
    const onRefresh = jest.fn();
    render(
      <AlifeLocalHealthPanel
        health={createReachableHealth()}
        loading={false}
        onRefresh={onRefresh}
      />,
      { wrapper: Wrapper },
    );

    fireEvent.click(screen.getByRole('button', { name: /check local health/i }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('renders not configured without inventing runtime values', () => {
    render(
      <AlifeLocalHealthPanel
        health={{
          state: 'notConfigured',
          configured: false,
          checkedAt: '2026-07-05T03:04:05.000Z',
        }}
        loading={false}
        onRefresh={jest.fn()}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByText('Not configured')).toBeDefined();
    expect(
      screen.getByText('Local Alife health checks are not configured for this server.'),
    ).toBeDefined();
    expect(screen.queryByText('FoxAgent')).toBeNull();
    expect(screen.queryByText('1.2.3')).toBeNull();
    expect(screen.getAllByText('Not reported').length).toBeGreaterThanOrEqual(5);
  });

  it.each([
    ['unreachable', 'requestFailed', 'Unreachable'],
    ['authRequired', 'http_401', 'Auth required'],
    ['invalidResponse', 'invalidJson', 'Invalid response'],
    ['error', 'baseUrlMustBeLoopback', 'Error'],
  ] as const)('renders %s as an advisory status with reason', (state, reason, label) => {
    render(
      <AlifeLocalHealthPanel
        health={createStateHealth(state, reason)}
        loading={false}
        onRefresh={jest.fn()}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByText(label)).toBeDefined();
    expect(
      screen.getByText(messages['pet.alifeLocalHealth'][`description.${state}`]),
    ).toBeDefined();
    expect(screen.getByText('Reason')).toBeDefined();
    expect(screen.getByText(reason)).toBeDefined();
  });

  it('shows loading text for null health without stale reachable status', () => {
    render(<AlifeLocalHealthPanel health={null} loading onRefresh={jest.fn()} />, {
      wrapper: Wrapper,
    });

    expect(screen.getByText('Checking Alife local health...')).toBeDefined();
    expect(screen.queryByText('Reachable')).toBeNull();
  });
});
