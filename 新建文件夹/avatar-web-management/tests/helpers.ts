import http from 'http';

const BASE = process.env.TEST_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

type RequestResult = {
  status: number;
  body: Record<string, any>;
  headers: Record<string, string>;
};

type RequestOptions = {
  token?: string;
  cookies?: Record<string, string>;
};

// ─── overloads ────────────────────────────────────────

export function request(method: string, path: string): Promise<RequestResult>;
export function request(method: string, path: string, token: string): Promise<RequestResult>;
export function request(method: string, path: string, token: string, body: unknown): Promise<RequestResult>;
export function request(method: string, path: string, options: RequestOptions): Promise<RequestResult>;
export function request(method: string, path: string, token: string | undefined, body: unknown): Promise<RequestResult>;

export function request(
  method: string,
  path: string,
  tokenOrOptions?: string | RequestOptions,
  body?: unknown,
) {
  return new Promise<RequestResult>((resolve, reject) => {
    const url = new URL(path, BASE);
    const data = body ? JSON.stringify(body) : undefined;
    const headers: Record<string, string> = { 'User-Agent': 'integration-test' };

    let token: string | undefined;
    if (typeof tokenOrOptions === 'string') {
      token = tokenOrOptions;
    } else if (tokenOrOptions) {
      token = tokenOrOptions.token;
      if (tokenOrOptions.cookies) {
        const cookiePairs = Object.entries(tokenOrOptions.cookies)
          .map(([k, v]) => `${k}=${v}`);
        if (cookiePairs.length > 0) headers['Cookie'] = cookiePairs.join('; ');
      }
    }

    if (data) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(url.href, { method, headers }, (res) => {
      let responseBody = '';
      const resHeaders: Record<string, string> = {};
      // Collect lowercased response headers
      for (const [k, v] of Object.entries(res.headers)) {
        if (v) resHeaders[k] = Array.isArray(v) ? v.join(', ') : v;
      }

      res.on('data', (chunk) => (responseBody += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode || 500, body: JSON.parse(responseBody), headers: resHeaders });
        } catch {
          resolve({ status: res.statusCode || 500, body: { raw: responseBody }, headers: resHeaders });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Request timeout')); });

    if (data) req.write(data);
    req.end();
  });
}

export const get = (path: string, token?: string) => request('GET', path, token!);
export const post = (path: string, body?: unknown, token?: string) => request('POST', path, token!, body);
export const put = (path: string, body?: unknown, token?: string) => request('PUT', path, token!, body);
export const del = (path: string, token?: string) => request('DELETE', path, token!);

export async function loginAs(email: string, password: string): Promise<string | undefined> {
  const res = await post('/api/auth/login', { email, password });
  return (res.body.data as Record<string, unknown>)?.accessToken as string | undefined;
}

export async function loginAndGetCookies(email: string, password: string) {
  const res = await post('/api/auth/login', { email, password });
  const token = (res.body.data as Record<string, unknown>)?.accessToken as string | undefined;
  // Extract refreshToken from Set-Cookie header
  const setCookie = res.headers['set-cookie'];
  let refreshToken: string | undefined;
  if (setCookie) {
    const match = setCookie.match(/refreshToken=([^;]+)/);
    refreshToken = match ? match[1] : undefined;
  }
  return { token, refreshToken };
}
