import { getRequestId, runWithRequestContext } from '@/lib/request-context';

describe('request-context', () => {
  describe('getRequestId', () => {
    it('returns undefined outside a context', () => {
      expect(getRequestId()).toBeUndefined();
    });

    it('returns requestId inside a context', () => {
      runWithRequestContext('req-abc-123', () => {
        expect(getRequestId()).toBe('req-abc-123');
      });
    });

    it('returns undefined after context scope ends', () => {
      runWithRequestContext('req-xyz', () => {
        // inside
      });
      expect(getRequestId()).toBeUndefined();
    });

    it('nested contexts preserve the outer requestId', () => {
      runWithRequestContext('outer-id', () => {
        expect(getRequestId()).toBe('outer-id');
        runWithRequestContext('inner-id', () => {
          // AsyncLocalStorage.run creates a new store, so inner overwrites
          expect(getRequestId()).toBe('inner-id');
        });
        // After inner ends, we're back to outer
        expect(getRequestId()).toBe('outer-id');
      });
    });

    it('returns value from the synchronous fn', () => {
      const result = runWithRequestContext('req-1', () => {
        return 'computed-value';
      });
      expect(result).toBe('computed-value');
    });

    it('throws if fn throws, and context is lost after', () => {
      expect(() => {
        runWithRequestContext('req-err', () => {
          throw new Error('boom');
        });
      }).toThrow('boom');
      expect(getRequestId()).toBeUndefined();
    });
  });
});
