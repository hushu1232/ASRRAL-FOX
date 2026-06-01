interface RequestContext {
  requestId: string;
}

let storage: { getStore: () => RequestContext | undefined; run: (ctx: RequestContext, fn: () => any) => any } | null = null;

// async_hooks is Node.js-only — guard against client-side bundling
if (typeof window === 'undefined') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AsyncLocalStorage } = require('async_hooks');
    storage = new AsyncLocalStorage<RequestContext>();
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
