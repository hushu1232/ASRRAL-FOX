type JsonObject = Record<string, unknown>;

export type WebBridgePreflightFetch = (url: string, init?: RequestInit) => Promise<Response>;

export type WebBridgePreflightConfig = {
  baseUrl: string;
  email: string;
  password: string;
  timeoutMs: number;
  syncPayload: {
    clientVersion: string;
    capabilities: string[];
  };
};

export type WebBridgePreflightCheck = {
  name: string;
  ok: boolean;
  status?: number;
  detail: string;
};

export type WebBridgePreflightResult = {
  ok: boolean;
  checks: WebBridgePreflightCheck[];
};

type LoginState = {
  accessToken: string;
  refreshCookie?: string;
};

const DEFAULT_SYNC_PAYLOAD = {
  clientVersion: 'desktop-webbridge-preflight',
  capabilities: ['config', 'assets', 'avatar'],
};

function normalizeBaseUrl(value: string | undefined): string {
  return (value || 'http://localhost:3000').replace(/\/+$/, '');
}

export function createWebBridgePreflightConfig(
  env: Partial<NodeJS.ProcessEnv> = process.env,
): WebBridgePreflightConfig {
  return {
    baseUrl: normalizeBaseUrl(env.WEBBRIDGE_BASE_URL || env.TEST_BASE_URL || env.NEXT_PUBLIC_APP_URL),
    email: env.WEBBRIDGE_EMAIL || 'demo@example.com',
    password: env.WEBBRIDGE_PASSWORD || 'demo1234',
    timeoutMs: Number(env.WEBBRIDGE_TIMEOUT_MS || 10_000),
    syncPayload: DEFAULT_SYNC_PAYLOAD,
  };
}

function endpoint(config: WebBridgePreflightConfig, path: string): string {
  return `${config.baseUrl}${path}`;
}

async function requestJson(
  fetchImpl: WebBridgePreflightFetch,
  config: WebBridgePreflightConfig,
  path: string,
  init: RequestInit = {},
) {
  const response = await fetchImpl(endpoint(config, path), {
    ...init,
    signal: init.signal || AbortSignal.timeout(config.timeoutMs),
  });
  const body = await response.json().catch(() => ({}));
  return { response, body: body as JsonObject };
}

function responseData(body: JsonObject): JsonObject {
  const data = body.data;
  return data && typeof data === 'object' && !Array.isArray(data) ? data as JsonObject : {};
}

function getToken(body: JsonObject): string | undefined {
  const data = responseData(body);
  const token = data.accessToken || data.token;
  return typeof token === 'string' && token.length > 0 ? token : undefined;
}

function getRefreshCookie(response: Response): string | undefined {
  const setCookie = response.headers.get('set-cookie');
  const match = setCookie?.match(/refreshToken=([^;]+)/);
  return match ? `refreshToken=${match[1]}` : undefined;
}

function hasString(data: JsonObject, key: string): boolean {
  return typeof data[key] === 'string' && String(data[key]).length > 0;
}

function hasArray(data: JsonObject, key: string): boolean {
  return Array.isArray(data[key]);
}

function requireFields(data: JsonObject, fields: string[]): string | undefined {
  const missing = fields.filter((field) => !(field in data));
  return missing.length > 0 ? `missing fields: ${missing.join(', ')}` : undefined;
}

function okCheck(name: string, status: number | undefined, detail = 'ok'): WebBridgePreflightCheck {
  return { name, ok: true, status, detail };
}

function failCheck(name: string, status: number | undefined, detail: string): WebBridgePreflightCheck {
  return { name, ok: false, status, detail };
}

async function checkHealth(
  fetchImpl: WebBridgePreflightFetch,
  config: WebBridgePreflightConfig,
): Promise<WebBridgePreflightCheck> {
  const { response } = await requestJson(fetchImpl, config, '/api/health');
  return response.ok
    ? okCheck('health', response.status)
    : failCheck('health', response.status, `HTTP ${response.status}`);
}

async function checkLogin(
  fetchImpl: WebBridgePreflightFetch,
  config: WebBridgePreflightConfig,
): Promise<{ check: WebBridgePreflightCheck; state?: LoginState }> {
  const { response, body } = await requestJson(fetchImpl, config, '/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: config.email, password: config.password }),
  });
  const accessToken = getToken(body);
  if (!response.ok || !accessToken) {
    return {
      check: failCheck('login', response.status, accessToken ? `HTTP ${response.status}` : 'missing accessToken'),
    };
  }

  return {
    check: okCheck('login', response.status),
    state: { accessToken, refreshCookie: getRefreshCookie(response) },
  };
}

async function checkRefresh(
  fetchImpl: WebBridgePreflightFetch,
  config: WebBridgePreflightConfig,
  state: LoginState,
): Promise<{ check: WebBridgePreflightCheck; accessToken: string }> {
  if (!state.refreshCookie) {
    return {
      check: failCheck('refresh', undefined, 'login response did not set refreshToken cookie'),
      accessToken: state.accessToken,
    };
  }

  const { response, body } = await requestJson(fetchImpl, config, '/api/auth/refresh', {
    method: 'POST',
    headers: { cookie: state.refreshCookie },
  });
  const accessToken = getToken(body);
  if (!response.ok || !accessToken) {
    return {
      check: failCheck('refresh', response.status, accessToken ? `HTTP ${response.status}` : 'missing accessToken'),
      accessToken: state.accessToken,
    };
  }

  return { check: okCheck('refresh', response.status), accessToken };
}

async function checkPetConfig(
  fetchImpl: WebBridgePreflightFetch,
  config: WebBridgePreflightConfig,
  accessToken: string,
): Promise<WebBridgePreflightCheck> {
  const { response, body } = await requestJson(fetchImpl, config, '/api/pet/config', {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const data = responseData(body);

  if (!response.ok) {
    return failCheck('pet config', response.status, `HTTP ${response.status}`);
  }
  if (!hasString(data, 'id')) {
    return failCheck('pet config', response.status, 'missing config id');
  }

  return okCheck('pet config', response.status);
}

async function checkPetSync(
  fetchImpl: WebBridgePreflightFetch,
  config: WebBridgePreflightConfig,
  accessToken: string,
): Promise<WebBridgePreflightCheck> {
  const { response, body } = await requestJson(fetchImpl, config, '/api/pet/sync', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(config.syncPayload),
  });
  const data = responseData(body);

  if (!response.ok) {
    return failCheck('pet sync', response.status, `HTTP ${response.status}`);
  }

  const missing = requireFields(data, ['version', 'petName', 'animationModel', 'mappedAssets']);
  if (missing) {
    return failCheck('pet sync', response.status, missing);
  }
  if (!hasArray(data, 'mappedAssets')) {
    return failCheck('pet sync', response.status, 'mappedAssets is not an array');
  }

  return okCheck('pet sync', response.status);
}

async function checkPetExport(
  fetchImpl: WebBridgePreflightFetch,
  config: WebBridgePreflightConfig,
  accessToken: string,
): Promise<WebBridgePreflightCheck> {
  const { response, body } = await requestJson(fetchImpl, config, '/api/pet/export', {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const data = responseData(body);

  if (!response.ok) {
    return failCheck('pet export', response.status, `HTTP ${response.status}`);
  }

  const missing = requireFields(data, [
    'version',
    'petName',
    'animationModel',
    'params',
    'bodyParams',
    'equippedParts',
    'mappedAssets',
  ]);
  if (missing) {
    return failCheck('pet export', response.status, missing);
  }

  for (const key of ['params', 'bodyParams', 'equippedParts', 'mappedAssets']) {
    if (!hasArray(data, key)) {
      return failCheck('pet export', response.status, `${key} is not an array`);
    }
  }

  return okCheck('pet export', response.status);
}

async function checkPackageManifest(
  fetchImpl: WebBridgePreflightFetch,
  config: WebBridgePreflightConfig,
  accessToken: string,
): Promise<WebBridgePreflightCheck> {
  const packageId = 'current-pet-character-bundle';
  const { response, body } = await requestJson(fetchImpl, config, `/api/webbridge/packages/${packageId}/manifest`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const data = responseData(body);

  if (!response.ok) {
    return failCheck('package manifest', response.status, `HTTP ${response.status}`);
  }
  if (data.packageId !== packageId) {
    return failCheck('package manifest', response.status, 'unexpected packageId');
  }
  if (!Array.isArray(data.files) || data.files.length === 0) {
    return failCheck('package manifest', response.status, 'missing files');
  }
  const [firstFile] = data.files;
  if (!firstFile || typeof firstFile !== 'object' || Array.isArray(firstFile)) {
    return failCheck('package manifest', response.status, 'invalid package file');
  }
  if (!hasString(firstFile as JsonObject, 'sha256')) {
    return failCheck('package manifest', response.status, 'package file missing sha256');
  }
  const activationPolicy = data.activationPolicy;
  if (!activationPolicy || typeof activationPolicy !== 'object' || Array.isArray(activationPolicy)) {
    return failCheck('package manifest', response.status, 'missing activationPolicy');
  }
  const policy = activationPolicy as JsonObject;
  if (policy.autoApply !== false) {
    return failCheck('package manifest', response.status, 'activationPolicy.autoApply must be false');
  }
  if (policy.requiresLocalConfirmation !== true) {
    return failCheck('package manifest', response.status, 'activationPolicy.requiresLocalConfirmation must be true');
  }

  return okCheck('package manifest', response.status);
}

export async function runWebBridgePreflight(
  config = createWebBridgePreflightConfig(),
  fetchImpl: WebBridgePreflightFetch = fetch,
): Promise<WebBridgePreflightResult> {
  const checks: WebBridgePreflightCheck[] = [];

  try {
    checks.push(await checkHealth(fetchImpl, config));
    if (!checks.at(-1)?.ok) return { ok: false, checks };

    const login = await checkLogin(fetchImpl, config);
    checks.push(login.check);
    if (!login.state) return { ok: false, checks };

    const refresh = await checkRefresh(fetchImpl, config, login.state);
    checks.push(refresh.check);
    if (!refresh.check.ok) return { ok: false, checks };

    checks.push(await checkPetConfig(fetchImpl, config, refresh.accessToken));
    if (!checks.at(-1)?.ok) return { ok: false, checks };

    checks.push(await checkPetSync(fetchImpl, config, refresh.accessToken));
    if (!checks.at(-1)?.ok) return { ok: false, checks };

    checks.push(await checkPetExport(fetchImpl, config, refresh.accessToken));
    if (!checks.at(-1)?.ok) return { ok: false, checks };

    checks.push(await checkPackageManifest(fetchImpl, config, refresh.accessToken));
    return { ok: checks.every((check) => check.ok), checks };
  } catch (error) {
    checks.push(failCheck('request', undefined, error instanceof Error ? error.message : String(error)));
    return { ok: false, checks };
  }
}

function printResult(result: WebBridgePreflightResult, config: WebBridgePreflightConfig): void {
  console.log(`WebBridge preflight: ${config.baseUrl}`);
  for (const check of result.checks) {
    const marker = check.ok ? 'PASS' : 'FAIL';
    const status = check.status ? ` HTTP ${check.status}` : '';
    console.log(`[${marker}] ${check.name}${status} - ${check.detail}`);
  }
}

if (require.main === module) {
  const config = createWebBridgePreflightConfig();
  runWebBridgePreflight(config).then((result) => {
    printResult(result, config);
    process.exitCode = result.ok ? 0 : 1;
  });
}
