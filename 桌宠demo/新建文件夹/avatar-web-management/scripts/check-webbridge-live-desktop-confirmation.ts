import { createInterface, type Interface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

export type LiveDesktopConfirmationConfig = {
  baseUrl: string;
  email: string;
  password: string;
  dotnetExe: string | null;
  alifeRoot: string | null;
  localHealthBaseUrl: string;
  localHealthToken: string | null;
  evidenceEnabled: boolean;
  timeoutMs: number;
  pollMs: number;
};

type ValidLiveDesktopConfirmationConfig = LiveDesktopConfirmationConfig & {
  dotnetExe: string;
  alifeRoot: string;
  localHealthToken: string;
};

export type LiveDesktopConfirmationFetch = (
  url: string,
  init?: RequestInit,
) => Promise<Response>;

export type ConsoleLike = Pick<typeof console, 'log' | 'error'>;

export type LiveDesktopConfirmationDependencies = {
  fetch?: LiveDesktopConfirmationFetch;
  console?: ConsoleLike;
  promptForManualConfirmation?: () => Promise<void>;
  delay?: (ms: number) => Promise<void>;
  now?: () => Date;
};

export type AlifeLocalProbeConfig = {
  baseUrl: string;
  token: string;
  timeoutMs: number;
};

export type AlifeLocalProbeResult =
  | {
      reachable: true;
      healthStatus: string;
      runtimeStatus: string;
    }
  | {
      reachable: false;
      reason: string;
    };

export type WebBridgeStatus = {
  packageState: string;
  summaryKind: string;
  primaryAction: string;
  requiresLocalConfirmation?: boolean;
};

type LoginConfig = {
  baseUrl: string;
  email: string;
  password: string;
  timeoutMs: number;
};

type AuthenticatedFoxdConfig = {
  baseUrl: string;
  accessToken: string;
  timeoutMs: number;
};

type PublishConfig = AuthenticatedFoxdConfig & {
  now?: () => Date;
};

type WaitStatusConfig = AuthenticatedFoxdConfig & {
  timeoutMs: number;
  pollMs: number;
  expectedLabel: string;
  matches: (status: WebBridgeStatus) => boolean;
};

const DEFAULT_BASE_URL = 'http://localhost:3000';
const DEFAULT_LOCAL_HEALTH_BASE_URL = 'http://127.0.0.1:8787';
const DEFAULT_TIMEOUT_MS = 300_000;
const DEFAULT_POLL_MS = 2_000;

function normalizeBaseUrl(value: string | undefined, fallback: string): string {
  return (value || fallback).replace(/\/+$/, '');
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function createLiveDesktopConfirmationConfig(
  env: Partial<NodeJS.ProcessEnv> = process.env,
): LiveDesktopConfirmationConfig {
  return {
    baseUrl: normalizeBaseUrl(
      env.WEBBRIDGE_BASE_URL || env.TEST_BASE_URL || `http://localhost:${env.PORT || '3000'}`,
      DEFAULT_BASE_URL,
    ),
    email: env.WEBBRIDGE_EMAIL || 'demo@example.com',
    password: env.WEBBRIDGE_PASSWORD || 'demo1234',
    dotnetExe: env.DOTNET_EXE || null,
    alifeRoot: env.ALIFE_ROOT || null,
    localHealthBaseUrl: normalizeBaseUrl(
      env.ALIFE_LOCAL_HEALTH_BASE_URL || env.FOXD_ALIFE_LOCAL_HEALTH_BASE_URL,
      DEFAULT_LOCAL_HEALTH_BASE_URL,
    ),
    localHealthToken:
      env.ALIFE_LOCAL_HEALTH_TOKEN || env.FOXD_ALIFE_LOCAL_HEALTH_TOKEN || null,
    evidenceEnabled: env.ALIFE_LIVE_DESKTOP_CONFIRMATION === 'true',
    timeoutMs: parsePositiveInteger(
      env.ALIFE_LIVE_DESKTOP_CONFIRMATION_TIMEOUT_MS,
      DEFAULT_TIMEOUT_MS,
    ),
    pollMs: parsePositiveInteger(env.ALIFE_LIVE_DESKTOP_CONFIRMATION_POLL_MS, DEFAULT_POLL_MS),
  };
}

export function validateLiveDesktopConfirmationConfig(
  config: LiveDesktopConfirmationConfig,
): ValidLiveDesktopConfirmationConfig {
  if (!config.evidenceEnabled) {
    throw new Error(
      'ALIFE_LIVE_DESKTOP_CONFIRMATION must be set to true before live desktop confirmation evidence can run.',
    );
  }

  if (!config.dotnetExe) {
    throw new Error('DOTNET_EXE is required for live desktop confirmation evidence.');
  }

  if (!config.alifeRoot) {
    throw new Error('ALIFE_ROOT is required for live desktop confirmation evidence.');
  }

  if (!config.localHealthToken) {
    throw new Error('ALIFE_LOCAL_HEALTH_TOKEN is required for live desktop confirmation evidence.');
  }

  return {
    ...config,
    dotnetExe: config.dotnetExe,
    alifeRoot: config.alifeRoot,
    localHealthToken: config.localHealthToken,
  };
}

function endpoint(baseUrl: string, path: string): string {
  return `${baseUrl}${path}`;
}

function stringField(value: unknown, key: string): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return 'unknown';
  }

  const field = (value as Record<string, unknown>)[key];
  return typeof field === 'string' && field.length > 0 ? field : 'unknown';
}

async function fetchJsonWithAuth(
  fetchImpl: LiveDesktopConfirmationFetch,
  url: string,
  token: string,
  timeoutMs: number,
): Promise<{ response: Response; body: unknown }> {
  const response = await fetchImpl(url, {
    method: 'GET',
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(timeoutMs),
  });

  const body = await response.json().catch(() => ({}));
  return { response, body };
}

export async function probeAlifeLocalProcess(
  config: AlifeLocalProbeConfig,
  fetchImpl: LiveDesktopConfirmationFetch = fetch,
): Promise<AlifeLocalProbeResult> {
  try {
    const healthUrl = endpoint(config.baseUrl, '/api/alife/health');
    const health = await fetchJsonWithAuth(fetchImpl, healthUrl, config.token, config.timeoutMs);
    if (!health.response.ok) {
      return {
        reachable: false,
        reason: `HTTP ${health.response.status} from ${healthUrl}`,
      };
    }

    const statusUrl = endpoint(config.baseUrl, '/api/alife/status');
    const status = await fetchJsonWithAuth(fetchImpl, statusUrl, config.token, config.timeoutMs);
    if (!status.response.ok) {
      return {
        reachable: false,
        reason: `HTTP ${status.response.status} from ${statusUrl}`,
      };
    }

    return {
      reachable: true,
      healthStatus: stringField(health.body, 'status'),
      runtimeStatus: stringField(status.body, 'status'),
    };
  } catch (error) {
    return {
      reachable: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

function dataObject(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {};
  }

  const data = (body as Record<string, unknown>).data;
  return data && typeof data === 'object' && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : {};
}

function requiredString(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Response data missing ${key}.`);
  }
  return value;
}

async function requestJson(
  fetchImpl: LiveDesktopConfirmationFetch,
  url: string,
  init: RequestInit,
): Promise<{ response: Response; body: unknown }> {
  const response = await fetchImpl(url, init);
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

export async function loginToFoxd(
  config: LoginConfig,
  fetchImpl: LiveDesktopConfirmationFetch = fetch,
): Promise<string> {
  const { response, body } = await requestJson(fetchImpl, `${config.baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: config.email, password: config.password }),
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`FOXD login failed with HTTP ${response.status}.`);
  }

  return requiredString(dataObject(body), 'accessToken');
}

function evidenceTimestamp(now: Date): string {
  return now.toISOString().replace(/\D/g, '').slice(0, 14);
}

export async function publishEvidencePetConfig(
  config: PublishConfig,
  fetchImpl: LiveDesktopConfirmationFetch = fetch,
): Promise<string> {
  const marker = `live-desktop-confirmation-${evidenceTimestamp(config.now?.() ?? new Date())}`;
  const { response } = await requestJson(fetchImpl, `${config.baseUrl}/api/pet/config`, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${config.accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      petName: marker,
      characterExtra: `${marker}-character-extra`,
    }),
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Publishing evidence pet config failed with HTTP ${response.status}.`);
  }

  return marker;
}

export async function readWebBridgeStatus(
  config: AuthenticatedFoxdConfig,
  fetchImpl: LiveDesktopConfirmationFetch = fetch,
): Promise<WebBridgeStatus> {
  const { response, body } = await requestJson(fetchImpl, `${config.baseUrl}/api/pet/sync/status`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${config.accessToken}`,
    },
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Reading WebBridge sync status failed with HTTP ${response.status}.`);
  }

  const data = dataObject(body);
  return {
    packageState: requiredString(data, 'packageState'),
    summaryKind: requiredString(data, 'summaryKind'),
    primaryAction: requiredString(data, 'primaryAction'),
    requiresLocalConfirmation:
      typeof data.requiresLocalConfirmation === 'boolean'
        ? data.requiresLocalConfirmation
        : undefined,
  };
}

export async function waitForWebBridgeStatus(
  config: WaitStatusConfig,
  fetchImpl: LiveDesktopConfirmationFetch = fetch,
  delay: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<WebBridgeStatus> {
  const deadline = Date.now() + config.timeoutMs;
  let lastStatus: WebBridgeStatus | null = null;

  while (Date.now() <= deadline) {
    lastStatus = await readWebBridgeStatus(config, fetchImpl);
    if (lastStatus.packageState === 'failed' || lastStatus.summaryKind === 'failed') {
      throw new Error(
        `FOXD reported failed WebBridge status while waiting for ${config.expectedLabel}.`,
      );
    }
    if (config.matches(lastStatus)) {
      return lastStatus;
    }
    await delay(config.pollMs);
  }

  const lastLabel = lastStatus
    ? `${lastStatus.packageState}/${lastStatus.summaryKind}/${lastStatus.primaryAction}`
    : 'no status observed';
  throw new Error(`Timed out waiting for ${config.expectedLabel}. Last status: ${lastLabel}.`);
}

async function promptForManualConfirmation(): Promise<void> {
  let reader: Interface | null = null;
  try {
    reader = createInterface({ input, output });
    await reader.question('Press Enter after confirming the package inside Alife desktop...');
  } finally {
    reader?.close();
  }
}

function isStagedConfirmationStatus(status: WebBridgeStatus): boolean {
  return (
    status.packageState === 'staged' &&
    status.summaryKind === 'localConfirmationRequired' &&
    status.primaryAction === 'confirmInDesktop'
  );
}

function isAppliedStatus(status: WebBridgeStatus): boolean {
  return (
    status.packageState === 'applied' &&
    status.summaryKind === 'upToDate' &&
    status.primaryAction === 'none' &&
    status.requiresLocalConfirmation === false
  );
}

export async function runLiveDesktopConfirmationEvidence(
  config = createLiveDesktopConfirmationConfig(),
  dependencies: LiveDesktopConfirmationDependencies = {},
): Promise<void> {
  const validConfig = validateLiveDesktopConfirmationConfig(config);
  const fetchImpl = dependencies.fetch ?? fetch;
  const logger = dependencies.console ?? console;
  const delay = dependencies.delay;
  const manualPrompt = dependencies.promptForManualConfirmation ?? promptForManualConfirmation;

  const initialProbe = await probeAlifeLocalProcess(
    {
      baseUrl: validConfig.localHealthBaseUrl,
      token: validConfig.localHealthToken,
      timeoutMs: validConfig.timeoutMs,
    },
    fetchImpl,
  );
  if (!initialProbe.reachable) {
    throw new Error(`Alife local management API unreachable before staging: ${initialProbe.reason}`);
  }

  const accessToken = await loginToFoxd(
    {
      baseUrl: validConfig.baseUrl,
      email: validConfig.email,
      password: validConfig.password,
      timeoutMs: validConfig.timeoutMs,
    },
    fetchImpl,
  );

  await publishEvidencePetConfig(
    {
      baseUrl: validConfig.baseUrl,
      accessToken,
      timeoutMs: validConfig.timeoutMs,
      now: dependencies.now,
    },
    fetchImpl,
  );

  await waitForWebBridgeStatus(
    {
      baseUrl: validConfig.baseUrl,
      accessToken,
      timeoutMs: validConfig.timeoutMs,
      pollMs: validConfig.pollMs,
      expectedLabel: 'staged/localConfirmationRequired/confirmInDesktop',
      matches: isStagedConfirmationStatus,
    },
    fetchImpl,
    delay,
  );

  logger.log('ManualActionRequired: confirm package inside the already-running Alife desktop process.');
  await manualPrompt();

  const followupProbe = await probeAlifeLocalProcess(
    {
      baseUrl: validConfig.localHealthBaseUrl,
      token: validConfig.localHealthToken,
      timeoutMs: validConfig.timeoutMs,
    },
    fetchImpl,
  );
  if (!followupProbe.reachable) {
    throw new Error(`Alife local management API unreachable after manual confirmation: ${followupProbe.reason}`);
  }

  await waitForWebBridgeStatus(
    {
      baseUrl: validConfig.baseUrl,
      accessToken,
      timeoutMs: validConfig.timeoutMs,
      pollMs: validConfig.pollMs,
      expectedLabel: 'applied/upToDate/none/requiresLocalConfirmation=false',
      matches: isAppliedStatus,
    },
    fetchImpl,
    delay,
  );

  logger.log('Live desktop confirmation evidence passed.');
  logger.log('EvidenceMode: live-desktop-manual-confirmation');
  logger.log(`AlifeRoot: ${validConfig.alifeRoot}`);
  logger.log('AlifeProcessReachable: true');
  logger.log('ManualActionRequired: confirmInDesktop');
  logger.log('WebStatusBefore: staged/localConfirmationRequired/confirmInDesktop');
  logger.log('WebStatusAfter: applied/upToDate/none/requiresLocalConfirmation=false');
  logger.log('BrowserControlUsed: false');
  logger.log('LocalApiApplyEndpointUsed: false');
  logger.log('DefaultRuntimeStorageTouched: false');
  logger.log('TouchedPath: FOXD WebBridge package pulled by already-running desktop process');
}

if (require.main === module) {
  runLiveDesktopConfirmationEvidence().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
