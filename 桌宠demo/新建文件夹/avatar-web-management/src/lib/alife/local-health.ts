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
type JsonFetchErrorResult = Exclude<JsonFetchResult, { kind: 'ok' }>;

const DEFAULT_ENABLED = 'false';
const DEFAULT_BASE_URL = 'http://127.0.0.1:8787';
const DEFAULT_TIMEOUT_MS = 1500;

export async function getAlifeLocalHealth(
  options: GetAlifeLocalHealthOptions = {},
): Promise<AlifeLocalHealthView> {
  const env = options.env ?? process.env;
  const checkedAt = (options.now?.() ?? new Date()).toISOString();
  const enabled =
    (env.FOXD_ALIFE_LOCAL_HEALTH_ENABLED ?? DEFAULT_ENABLED).trim().toLowerCase() === 'true';

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
    fetchImpl,
  );
  if (healthResult.kind !== 'ok') {
    return mapFetchError(healthResult, checkedAt);
  }

  const healthData = healthResult.data;

  const statusResult = await fetchJson(
    buildLocalEndpoint(normalizedBaseUrl, '/api/alife/status'),
    token,
    timeoutMs,
    fetchImpl,
  );
  if (statusResult.kind !== 'ok') {
    return mapFetchError(statusResult, checkedAt);
  }

  const sensitiveValues = collectSensitiveValues({
    token,
    baseUrl: normalizedBaseUrl,
    healthData,
    statusData: statusResult.data,
  });
  const health = sanitizeHealthResponse(healthData, sensitiveValues);
  if (!health) {
    return {
      state: 'invalidResponse',
      configured: true,
      checkedAt,
      reason: 'missingRequiredFields',
    };
  }

  const runtime = sanitizeRuntimeResponse(statusResult.data, sensitiveValues);
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
  return (
    hostname === '127.0.0.1' ||
    hostname === 'localhost' ||
    hostname === '[::1]' ||
    hostname === '::1'
  );
}

async function fetchJson(
  url: string,
  token: string,
  timeoutMs: number,
  fetchImpl: AlifeLocalHealthFetch,
): Promise<JsonFetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let responseReceived = false;

  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });
    responseReceived = true;

    if (!response.ok) {
      return {
        kind: 'httpError',
        status: response.status,
      };
    }

    return {
      kind: 'ok',
      data: await response.json(),
    };
  } catch (error) {
    if (!responseReceived || controller.signal.aborted || isAbortError(error)) {
      return { kind: 'requestFailed' };
    }

    if (isSyntaxError(error)) {
      return { kind: 'invalidJson' };
    }

    return { kind: 'requestFailed' };
  } finally {
    clearTimeout(timeout);
  }
}

function mapFetchError(result: JsonFetchErrorResult, checkedAt: string): AlifeLocalHealthView {
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

function sanitizeHealthResponse(
  data: unknown,
  sensitiveValues: string[],
): AlifeLocalHealthView['health'] | null {
  if (!isRecord(data)) {
    return null;
  }

  const status = publicStringField(data, 'status', sensitiveValues);
  const service = publicStringField(data, 'service', sensitiveValues);
  const version = publicStringField(data, 'version', sensitiveValues);
  const timestampUtc = publicStringField(data, 'timestampUtc', sensitiveValues);

  if (status === null || service === null || version === null || timestampUtc === null) {
    return null;
  }

  return {
    status,
    service,
    version,
    timestampUtc,
  };
}

function sanitizeRuntimeResponse(
  data: unknown,
  sensitiveValues: string[],
): AlifeLocalHealthView['runtime'] | null {
  if (!isRecord(data)) {
    return null;
  }

  const status = publicStringField(data, 'status', sensitiveValues);
  const agent = publicStringField(data, 'agent', sensitiveValues);
  const qchatEnabled = data.qchatEnabled;
  const visionEnabled = data.visionEnabled;
  const visionStatus = publicStringField(data, 'visionStatus', sensitiveValues);
  const visionReason = publicStringField(data, 'visionReason', sensitiveValues);
  const ttsEnabled = data.ttsEnabled;
  const ttsStatus = publicStringField(data, 'ttsStatus', sensitiveValues);
  const ttsReason = publicStringField(data, 'ttsReason', sensitiveValues);
  const outboxEnabled = data.outboxEnabled;
  const timestampUtc = publicStringField(data, 'timestampUtc', sensitiveValues);

  if (
    status === null ||
    agent === null ||
    typeof qchatEnabled !== 'boolean' ||
    typeof visionEnabled !== 'boolean' ||
    visionStatus === null ||
    visionReason === null ||
    typeof ttsEnabled !== 'boolean' ||
    ttsStatus === null ||
    ttsReason === null ||
    typeof outboxEnabled !== 'boolean' ||
    timestampUtc === null
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
    return url.origin;
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

function collectSensitiveValues({
  token,
  baseUrl,
  healthData,
  statusData,
}: {
  token: string;
  baseUrl: string;
  healthData: unknown;
  statusData: unknown;
}): string[] {
  const values = new Set<string>();
  addSensitiveValue(values, token);
  addSensitiveValue(values, baseUrl);

  try {
    const url = new URL(baseUrl);
    addSensitiveValue(values, url.host);
    addSensitiveValue(values, url.hostname);
  } catch {
    // Base URL has already been validated; keep this defensive for future callers.
  }

  addNamedSensitiveValues(values, healthData);
  addNamedSensitiveValues(values, statusData);

  return [...values];
}

function addNamedSensitiveValues(values: Set<string>, data: unknown): void {
  if (!isRecord(data)) {
    return;
  }

  for (const [key, value] of Object.entries(data)) {
    const normalizedKey = key.toLowerCase();
    if (
      normalizedKey === 'ownerid' ||
      normalizedKey === 'botid' ||
      normalizedKey === 'token' ||
      normalizedKey === 'baseurl'
    ) {
      addSensitiveValue(values, value);
    }
  }
}

function addSensitiveValue(values: Set<string>, value: unknown): void {
  if (typeof value !== 'string') {
    return;
  }

  const normalized = value.trim();
  if (normalized.length >= 4) {
    values.add(normalized);
  }
}

function publicStringField(
  data: Record<string, unknown>,
  key: string,
  sensitiveValues: string[],
): string | null {
  const value = data[key];
  if (typeof value !== 'string') {
    return null;
  }

  return containsSensitiveValue(value, sensitiveValues) ? null : value;
}

function containsSensitiveValue(value: string, sensitiveValues: string[]): boolean {
  const normalizedValue = value.toLowerCase();
  return sensitiveValues.some((sensitiveValue) =>
    normalizedValue.includes(sensitiveValue.toLowerCase()),
  );
}

function isAbortError(error: unknown): boolean {
  return isRecord(error) && error.name === 'AbortError';
}

function isSyntaxError(error: unknown): boolean {
  return error instanceof SyntaxError || (isRecord(error) && error.name === 'SyntaxError');
}
