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
const MAX_TIMEOUT_MS = 10_000;
const MIN_TOKEN_LENGTH = 8;

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

  if (!normalizedBaseUrl || !isLoopbackBaseUrl(baseUrl)) {
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
  if (token.length < MIN_TOKEN_LENGTH) {
    return {
      state: 'authRequired',
      configured: true,
      checkedAt,
      reason: 'tokenTooShort',
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

  if (!hasAllowedConfiguredLoopbackHost(value)) {
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
  return isLoopbackHostname(hostname);
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === '127.0.0.1' ||
    normalized === 'localhost' ||
    normalized === '[::1]' ||
    normalized === '::1'
  );
}

function hasAllowedConfiguredLoopbackHost(value: string): boolean {
  const rawAuthority = extractRawHttpAuthority(value);
  if (!rawAuthority) {
    return false;
  }

  if (rawAuthority.includes('@')) {
    return false;
  }

  const hostname = extractRawHostname(rawAuthority);
  return (
    hostname === '127.0.0.1' ||
    hostname === 'localhost' ||
    hostname === '[::1]' ||
    hostname === '::1'
  );
}

function extractRawHttpAuthority(value: string): string | null {
  const match = value.trim().match(/^http:\/\/([^/?#]+)(?:[/?#]|$)/i);
  return match?.[1].toLowerCase() ?? null;
}

function extractRawHostname(authority: string): string {
  if (authority.startsWith('[')) {
    const end = authority.indexOf(']');
    return end >= 0 ? authority.slice(0, end + 1) : authority;
  }

  if (authority === '::1' || authority.startsWith('::1:')) {
    return '::1';
  }

  const colon = authority.indexOf(':');
  return colon >= 0 ? authority.slice(0, colon) : authority;
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
      redirect: 'manual',
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
  return Number.isFinite(parsed) && parsed > 0
    ? Math.min(parsed, MAX_TIMEOUT_MS)
    : DEFAULT_TIMEOUT_MS;
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
  addSensitiveValue(values, token, 1);
  addSensitiveValue(values, baseUrl);

  addLoopbackBaseUrlAliases(values, baseUrl);

  addNamedSensitiveValues(values, healthData);
  addNamedSensitiveValues(values, statusData);

  return [...values];
}

function addLoopbackBaseUrlAliases(values: Set<string>, baseUrl: string): void {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    // Base URL has already been validated; keep this defensive for future callers.
    return;
  }

  const defaultPort = new URL(DEFAULT_BASE_URL).port;
  const ports = new Set([url.port, defaultPort].filter(Boolean));
  const portSuffixes = ports.size > 0 ? [...ports].map((port) => `:${port}`) : [''];

  for (const hostname of ['127.0.0.1', 'localhost', '[::1]']) {
    addSensitiveValue(values, hostname, 1);

    for (const portSuffix of portSuffixes) {
      addSensitiveValue(values, `${hostname}${portSuffix}`, 1);
      addSensitiveValue(values, `http://${hostname}${portSuffix}`, 1);
    }
  }

  addSensitiveValue(values, '::1', 1);
}

function addNamedSensitiveValues(
  values: Set<string>,
  data: unknown,
  seen = new WeakSet<object>(),
  sensitiveContainer = false,
): void {
  if (typeof data !== 'object' || data === null) {
    return;
  }

  if (seen.has(data)) {
    return;
  }
  seen.add(data);

  if (Array.isArray(data)) {
    for (const value of data) {
      addNamedSensitiveValues(values, value, seen);
    }
    return;
  }

  for (const [key, value] of Object.entries(data)) {
    const keyIsSensitive = isSensitiveResponseKey(key);
    const childIsSensitiveContainer = sensitiveContainer || isSensitiveContainerKey(key);

    if (keyIsSensitive || (sensitiveContainer && isSensitiveIdentifierLeafKey(key))) {
      addSensitiveLeafValues(values, value, seen);
    }
    addNamedSensitiveValues(values, value, seen, childIsSensitiveContainer);
  }
}

function addSensitiveLeafValues(values: Set<string>, data: unknown, seen: WeakSet<object>): void {
  if (typeof data === 'string' || typeof data === 'number') {
    addSensitiveValue(values, data, 1);
    return;
  }

  if (typeof data !== 'object' || data === null) {
    return;
  }

  if (seen.has(data)) {
    return;
  }
  seen.add(data);

  const children = Array.isArray(data) ? data : Object.values(data);
  for (const value of children) {
    addSensitiveLeafValues(values, value, seen);
  }
}

function addSensitiveValue(values: Set<string>, value: unknown, minimumLength = 4): void {
  let normalized: string;

  if (typeof value === 'string') {
    normalized = value.trim();
  } else if (typeof value === 'number' && Number.isFinite(value)) {
    normalized = String(value);
  } else {
    return;
  }

  if (normalized.length >= minimumLength) {
    values.add(normalized);
  }
}

function isSensitiveResponseKey(key: string): boolean {
  const normalized = normalizeResponseKey(key);
  const sensitiveKeys = new Set([
    'apikey',
    'authorization',
    'baseuri',
    'baseurl',
    'botid',
    'clientid',
    'credential',
    'credentials',
    'ownerid',
    'password',
    'secret',
    'sessionid',
    'userid',
    'workspaceid',
  ]);

  return (
    sensitiveKeys.has(normalized) ||
    normalized === 'token' ||
    normalized.endsWith('key') ||
    normalized.endsWith('secret') ||
    normalized.endsWith('token')
  );
}

function isSensitiveContainerKey(key: string): boolean {
  return new Set(['bot', 'client', 'owner', 'session', 'user', 'workspace']).has(
    normalizeResponseKey(key),
  );
}

function isSensitiveIdentifierLeafKey(key: string): boolean {
  return new Set(['id', 'ids', 'identifier', 'identifiers']).has(normalizeResponseKey(key));
}

function normalizeResponseKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, '').toLowerCase();
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

  return containsSensitiveValue(value, sensitiveValues) ||
    containsLoopbackUrl(value) ||
    containsLocalFilesystemPath(value)
    ? null
    : value;
}

function containsSensitiveValue(value: string, sensitiveValues: string[]): boolean {
  const normalizedValue = value.toLowerCase();
  return sensitiveValues.some((sensitiveValue) => {
    const normalizedSensitiveValue = sensitiveValue.toLowerCase();
    if (normalizedSensitiveValue.length < 4) {
      return new RegExp(
        `(^|[^a-z0-9])${escapeRegExp(normalizedSensitiveValue)}($|[^a-z0-9])`,
        'i',
      ).test(value);
    }

    return normalizedValue.includes(normalizedSensitiveValue);
  });
}

function containsLoopbackUrl(value: string): boolean {
  const urlMatches = value.match(/\bhttps?:\/\/[^\s"'<>]+/gi) ?? [];

  if (
    urlMatches.some((match) => {
      const candidate = match.replace(/[),.;]+$/g, '');
      try {
        const url = new URL(candidate);
        return isPublicLoopbackHostname(url.hostname);
      } catch {
        return false;
      }
    })
  ) {
    return true;
  }

  const bareMatches =
    value.match(
      /(?:^|[\s"'(])(\[[0-9a-f:.]+\]:\d+|(?:0x[0-9a-f]+|0[0-7]+|\d+|(?:\d{1,3}\.){0,3}\d{1,3}):\d+)(?=$|[\s"'),.;])/gi,
    ) ?? [];

  return bareMatches.some((match) => {
    const candidate = match.replace(/[),.;]+$/g, '');
    const trimmedCandidate = candidate.replace(/^[\s"'(]+/, '');
    try {
      const url = new URL(`http://${trimmedCandidate}`);
      return isPublicLoopbackHostname(url.hostname);
    } catch {
      return false;
    }
  });
}

function isPublicLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[(.*)\]$/, '$1');
  return (
    isLoopbackHostname(hostname) ||
    normalized === '0:0:0:0:0:0:0:1' ||
    normalized === '::ffff:127.0.0.1' ||
    normalized === '::ffff:7f00:1'
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsLocalFilesystemPath(value: string): boolean {
  return (
    /\bfile:\/\//i.test(value) ||
    /(?:^|[\s"'(])[A-Za-z]:[\\/][^\s"'<>]*/.test(value) ||
    /(?:^|[\s"'(])\\\\[^\\/\s"'<>]+\\[^\s"'<>]+/.test(value) ||
    /(?:^|[\s"'(])\/(?:home|users|var|tmp|opt|etc|usr|mnt|volumes|root|workspace|cache|app|data)\//i.test(
      value,
    )
  );
}

function isAbortError(error: unknown): boolean {
  return isRecord(error) && error.name === 'AbortError';
}

function isSyntaxError(error: unknown): boolean {
  return error instanceof SyntaxError || (isRecord(error) && error.name === 'SyntaxError');
}
