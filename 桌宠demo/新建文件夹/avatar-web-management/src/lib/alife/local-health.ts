export type AlifeLocalHealthState =
  | 'notConfigured'
  | 'reachable'
  | 'unreachable'
  | 'authRequired'
  | 'invalidResponse'
  | 'error';

export interface AlifeLocalHealthView {
  state: AlifeLocalHealthState;
  configured: boolean;
  checkedAt: string;
  reason?: string;
  health?: {
    status: string;
    service: string;
    version: string;
    timestampUtc: string;
  };
  runtime?: {
    status: string;
    agent: string;
    qchatEnabled: boolean;
    visionEnabled: boolean;
    visionStatus: string;
    visionReason: string;
    ttsEnabled: boolean;
    ttsStatus: string;
    ttsReason: string;
    outboxEnabled: boolean;
    timestampUtc: string;
  };
}

export interface GetAlifeLocalHealthOptions {
  env?: Record<string, string | undefined>;
  fetch?: AlifeLocalHealthFetch;
  now?: () => Date;
}

type AlifeLocalHealthFetch = (input: string, init?: RequestInit) => Promise<Response>;

type JsonFetchResult =
  | { kind: 'ok'; data: unknown }
  | { kind: 'httpError'; status: number }
  | { kind: 'invalidJson' }
  | { kind: 'requestFailed' };

const DEFAULT_ENABLED = 'false';
const DEFAULT_BASE_URL = 'http://127.0.0.1:8787';
const DEFAULT_TIMEOUT_MS = 1500;

export async function getAlifeLocalHealth(
  options: GetAlifeLocalHealthOptions = {}
): Promise<AlifeLocalHealthView> {
  const env = options.env ?? process.env;
  const checkedAt = (options.now?.() ?? new Date()).toISOString();
  const enabled = (env.FOXD_ALIFE_LOCAL_HEALTH_ENABLED ?? DEFAULT_ENABLED).trim().toLowerCase() === 'true';

  if (!enabled) {
    return {
      state: 'notConfigured',
      configured: false,
      checkedAt,
    };
  }

  const baseUrl = env.FOXD_ALIFE_LOCAL_HEALTH_BASE_URL ?? DEFAULT_BASE_URL;
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  if (!normalizedBaseUrl || !isLoopbackBaseUrl(normalizedBaseUrl)) {
    return {
      state: 'error',
      configured: true,
      checkedAt,
      reason: 'baseUrlMustBeLoopback',
    };
  }

  const token = env.FOXD_ALIFE_LOCAL_HEALTH_TOKEN?.trim();
  if (!token) {
    return {
      state: 'authRequired',
      configured: true,
      checkedAt,
      reason: 'tokenMissing',
    };
  }

  const fetchImpl = options.fetch ?? globalThis.fetch?.bind(globalThis);
  if (!fetchImpl) {
    return {
      state: 'unreachable',
      configured: true,
      checkedAt,
      reason: 'requestFailed',
    };
  }

  const timeoutMs = normalizeTimeoutMs(env.FOXD_ALIFE_LOCAL_HEALTH_TIMEOUT_MS);
  const healthResult = await fetchJson(
    buildLocalEndpoint(normalizedBaseUrl, '/api/alife/health'),
    token,
    timeoutMs,
    fetchImpl
  );
  const healthError = mapFetchError(healthResult, checkedAt);
  if (healthError) {
    return healthError;
  }

  const health = sanitizeHealthResponse(healthResult.data);
  if (!health) {
    return {
      state: 'invalidResponse',
      configured: true,
      checkedAt,
      reason: 'missingRequiredFields',
    };
  }

  const statusResult = await fetchJson(
    buildLocalEndpoint(normalizedBaseUrl, '/api/alife/status'),
    token,
    timeoutMs,
    fetchImpl
  );
  const statusError = mapFetchError(statusResult, checkedAt);
  if (statusError) {
    return statusError;
  }

  const runtime = sanitizeRuntimeResponse(statusResult.data);
  if (!runtime) {
    return {
      state: 'invalidResponse',
      configured: true,
      checkedAt,
      reason: 'missingRequiredFields',
    };
  }

  return {
    state: 'reachable',
    configured: true,
    checkedAt,
    health,
    runtime,
  };
}

export function isLoopbackBaseUrl(value: string): boolean {
  const normalized = normalizeBaseUrl(value);
  if (!normalized) {
    return false;
  }

  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    return false;
  }

  if (url.protocol !== 'http:') {
    return false;
  }

  const hostname = url.hostname.toLowerCase();
  return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '[::1]' || hostname === '::1';
}

async function fetchJson(
  url: string,
  token: string,
  timeoutMs: number,
  fetchImpl: AlifeLocalHealthFetch
): Promise<JsonFetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });
  } catch {
    clearTimeout(timeout);
    return { kind: 'requestFailed' };
  }

  clearTimeout(timeout);

  if (!response.ok) {
    return {
      kind: 'httpError',
      status: response.status,
    };
  }

  try {
    return {
      kind: 'ok',
      data: await response.json(),
    };
  } catch {
    return { kind: 'invalidJson' };
  }
}

function mapFetchError(
  result: JsonFetchResult,
  checkedAt: string
): AlifeLocalHealthView | null {
  if (result.kind === 'ok') {
    return null;
  }

  if (result.kind === 'requestFailed') {
    return {
      state: 'unreachable',
      configured: true,
      checkedAt,
      reason: 'requestFailed',
    };
  }

  if (result.kind === 'invalidJson') {
    return {
      state: 'invalidResponse',
      configured: true,
      checkedAt,
      reason: 'invalidJson',
    };
  }

  if (result.status === 401 || result.status === 403) {
    return {
      state: 'authRequired',
      configured: true,
      checkedAt,
      reason: `http_${result.status}`,
    };
  }

  return {
    state: 'error',
    configured: true,
    checkedAt,
    reason: `http_${result.status}`,
  };
}

function sanitizeHealthResponse(data: unknown): AlifeLocalHealthView['health'] | null {
  if (!isRecord(data)) {
    return null;
  }

  const status = data.status;
  const service = data.service;
  const version = data.version;
  const timestampUtc = data.timestampUtc;

  if (
    typeof status !== 'string' ||
    typeof service !== 'string' ||
    typeof version !== 'string' ||
    typeof timestampUtc !== 'string'
  ) {
    return null;
  }

  return {
    status,
    service,
    version,
    timestampUtc,
  };
}

function sanitizeRuntimeResponse(data: unknown): AlifeLocalHealthView['runtime'] | null {
  if (!isRecord(data)) {
    return null;
  }

  const status = data.status;
  const agent = data.agent;
  const qchatEnabled = data.qchatEnabled;
  const visionEnabled = data.visionEnabled;
  const visionStatus = data.visionStatus;
  const visionReason = data.visionReason;
  const ttsEnabled = data.ttsEnabled;
  const ttsStatus = data.ttsStatus;
  const ttsReason = data.ttsReason;
  const outboxEnabled = data.outboxEnabled;
  const timestampUtc = data.timestampUtc;

  if (
    typeof status !== 'string' ||
    typeof agent !== 'string' ||
    typeof qchatEnabled !== 'boolean' ||
    typeof visionEnabled !== 'boolean' ||
    typeof visionStatus !== 'string' ||
    typeof visionReason !== 'string' ||
    typeof ttsEnabled !== 'boolean' ||
    typeof ttsStatus !== 'string' ||
    typeof ttsReason !== 'string' ||
    typeof outboxEnabled !== 'boolean' ||
    typeof timestampUtc !== 'string'
  ) {
    return null;
  }

  return {
    status,
    agent,
    qchatEnabled,
    visionEnabled,
    visionStatus,
    visionReason,
    ttsEnabled,
    ttsStatus,
    ttsReason,
    outboxEnabled,
    timestampUtc,
  };
}

function normalizeBaseUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const bracketedIpv6Loopback = trimmed.replace(/^http:\/\/::1(?=[:/]|$)/i, 'http://[::1]');

  try {
    const url = new URL(bracketedIpv6Loopback);
    return url.href.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

function buildLocalEndpoint(baseUrl: string, path: string): string {
  return `${baseUrl}${path}`;
}

function normalizeTimeoutMs(value: string | undefined): number {
  if (!value) {
    return DEFAULT_TIMEOUT_MS;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
