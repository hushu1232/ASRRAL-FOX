import '@testing-library/jest-dom';
import fs from 'fs';
import path from 'path';

// Set RSA keys from project keys/ directory for RS256 JWT tests
const keysDir = path.join(process.cwd(), 'keys');
const privPath = path.join(keysDir, 'private.pem');
const pubPath = path.join(keysDir, 'public.pem');
const kidPath = path.join(keysDir, 'kid');

if (fs.existsSync(privPath) && fs.existsSync(pubPath)) {
  process.env.JWT_PRIVATE_KEY = fs.readFileSync(privPath, 'utf-8');
  process.env.JWT_PUBLIC_KEY = fs.readFileSync(pubPath, 'utf-8');
  if (fs.existsSync(kidPath)) {
    process.env.JWT_KEY_ID = fs.readFileSync(kidPath, 'utf-8').trim();
  }
}

// jsdom-only polyfills (skip in node test environment)
if (typeof window !== 'undefined') {
  // Add MessageChannel polyfill for antd Form (@rc-component/form uses it)
  // Node.js has MessageChannel in global scope, but jsdom doesn't
  if (typeof window.MessageChannel === 'undefined') {
    window.MessageChannel = (globalThis as typeof globalThis & { MessageChannel?: typeof MessageChannel }).MessageChannel;
    if (typeof window.MessageChannel === 'undefined') {
      // Fallback polyfill for older Node without MessageChannel
      class MessagePort {
        onmessage: ((e: MessageEvent) => void) | null = null;
        close() {}
        postMessage(_data: unknown) {}
        start() {}
        addEventListener(_type: string, _listener: EventListener) {}
        removeEventListener(_type: string, _listener: EventListener) {}
        dispatchEvent(_event: Event) { return true; }
      }
      window.MessageChannel = class MessageChannel {
        port1 = new MessagePort();
        port2 = new MessagePort();
      } as unknown as typeof MessageChannel;
    }
  }

  // Mock ResizeObserver for antd components (Tabs, Select, etc.)
  if (typeof window.ResizeObserver === 'undefined') {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }

  // jsdom does not implement getComputedStyle for pseudo-elements.
  // @rc-component/table calls getComputedStyle(elt, '::-webkit-scrollbar')
  // to measure scrollbar size, which throws. Override to return empty decl.
  const originalGetComputedStyle = window.getComputedStyle.bind(window);
  window.getComputedStyle = (elt: Element, pseudoElt?: string | null) => {
    if (pseudoElt) {
      try {
        // Try the original first — some pseudo-elements may be supported
        return originalGetComputedStyle(elt, pseudoElt);
      } catch {
        // Return the non-pseudo computed style as fallback
        return originalGetComputedStyle(elt);
      }
    }
    return originalGetComputedStyle(elt);
  };

  // Mock window.matchMedia for Ant Design responsive observer
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

// Mock next/navigation (works in both node and jsdom)
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/',
}));

// Mock next/image (works in both node and jsdom)
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { src, alt, width, height, fill, priority, unoptimized, sizes, quality, loader, placeholder, blurDataURL, onLoad, onError, ...rest } = props;
    // Strip next/image-specific props to avoid React DOM warnings
    void fill; void priority; void unoptimized; void sizes; void quality; void loader; void placeholder; void blurDataURL; void onLoad; void onError;
    // We must return a JSX element; using require to avoid TS issues in setup
    const React = require('react');
    return React.createElement('img', { src, alt, width, height, ...rest });
  },
}));

// Note: global.fetch is intentionally NOT mocked — integration tests
// (smoke, security) use the native Node.js fetch for real API calls.
// Unit tests that need a fetch mock should set it up in their own describe block.

// Suppress antd warning spam in tests
const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  const msg = String(args[0]);
  if (msg.includes('findDOMNode') || msg.includes('ReactDOM')) return;
  originalWarn.call(console, ...args);
};
