interface RequestContext {
  requestId: string;
}

interface RequestStorage<T> {
  getStore: () => T | undefined;
  run: <R>(ctx: T, fn: () => R) => R;
}

let storage: RequestStorage<RequestContext> | null = null;

// async_hooks is Node.js-only — guard against client-side bundling
if (typeof window === 'undefined') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const asyncHooks = require('async_hooks') as { AsyncLocalStorage: new <T>() => RequestStorage<T> };
    storage = new asyncHooks.AsyncLocalStorage<RequestContext>();
  } catch {
    // async_hooks unavailable (edge runtime, etc.)
  }
}

export function getRequestId(): string | undefined {
  return storage?.getStore()?.requestId;
}

export function runWithRequestContext<T>(requestId: string, fn: () => T): T {
  if (!storage) return fn();
  return storage.run({ requestId }, fn);
}
