/**
 * Circuit breaker — prevents cascading failures when external services degrade.
 * States: CLOSED (normal) → OPEN (fast-fail) → HALF_OPEN (probe) → CLOSED or OPEN.
 */

import { createLogger } from '@/lib/logger';

const log = createLogger('circuit-breaker');

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitOptions {
  name: string;
  failureThreshold?: number;   // consecutive failures to open circuit (default 5)
  resetTimeoutMs?: number;     // ms before half-open probe (default 30_000)
  successThreshold?: number;   // consecutive successes to close (default 2)
  halfOpenMaxRequests?: number; // max probe requests in half-open (default 1)
}

interface CircuitEntry {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number;
  openedAt: number;
  halfOpenInFlight: number;
}

const circuits = new Map<string, CircuitEntry>();

function getEntry(name: string): CircuitEntry {
  if (!circuits.has(name)) {
    circuits.set(name, {
      state: 'CLOSED', failures: 0, successes: 0,
      lastFailureTime: 0, openedAt: 0, halfOpenInFlight: 0,
    });
  }
  return circuits.get(name)!;
}

export function createCircuitBreaker(opts: CircuitOptions) {
  const {
    name,
    failureThreshold = 5,
    resetTimeoutMs = 30_000,
    successThreshold = 2,
    halfOpenMaxRequests = 1,
  } = opts;

  async function execute<T>(fn: () => Promise<T>): Promise<T> {
    const entry = getEntry(name);

    // If OPEN and timeout has passed → transition to HALF_OPEN
    if (entry.state === 'OPEN') {
      if (Date.now() - entry.openedAt >= resetTimeoutMs) {
        entry.state = 'HALF_OPEN';
        entry.successes = 0;
        entry.halfOpenInFlight = 0;
        log.info({ name, resetTimeoutMs }, 'Circuit transitioned OPEN → HALF_OPEN');
      } else {
        throw new CircuitOpenError(name, entry.openedAt, resetTimeoutMs);
      }
    }

    // If HALF_OPEN, limit concurrent probe requests
    if (entry.state === 'HALF_OPEN' && entry.halfOpenInFlight >= halfOpenMaxRequests) {
      throw new CircuitOpenError(name, entry.openedAt, resetTimeoutMs);
    }

    if (entry.state === 'HALF_OPEN') {
      entry.halfOpenInFlight++;
    }

    try {
      const result = await fn();

      // Success — count toward recovery
      if (entry.state === 'HALF_OPEN') {
        entry.successes++;
        entry.halfOpenInFlight--;
        if (entry.successes >= successThreshold) {
          entry.state = 'CLOSED';
          entry.failures = 0;
          entry.successes = 0;
          entry.halfOpenInFlight = 0;
          log.info({ name, successThreshold }, 'Circuit transitioned HALF_OPEN → CLOSED');
        }
      } else {
        // CLOSED — reset failure count on success
        entry.failures = 0;
      }
      return result;

    } catch (err) {
      // Failure
      entry.failures++;
      entry.lastFailureTime = Date.now();
      if (entry.state === 'HALF_OPEN') {
        entry.halfOpenInFlight--;
      }

      if (entry.state === 'CLOSED' && entry.failures >= failureThreshold) {
        entry.state = 'OPEN';
        entry.openedAt = Date.now();
        log.warn({ name, failures: entry.failures, failureThreshold },
          'Circuit transitioned CLOSED → OPEN');
      } else if (entry.state === 'HALF_OPEN') {
        entry.state = 'OPEN';
        entry.openedAt = Date.now();
        log.warn({ name }, 'Circuit transitioned HALF_OPEN → OPEN (probe failed)');
      }

      throw err;
    }
  }

  function getState(): CircuitState {
    return getEntry(name).state;
  }

  function reset(): void {
    const entry = getEntry(name);
    entry.state = 'CLOSED';
    entry.failures = 0;
    entry.successes = 0;
    entry.halfOpenInFlight = 0;
    log.info({ name }, 'Circuit manually reset → CLOSED');
  }

  return { execute, getState, reset };
}

export class CircuitOpenError extends Error {
  constructor(
    public circuitName: string,
    public openedAt: number,
    public resetTimeoutMs: number,
  ) {
    const remainingMs = Math.max(0, resetTimeoutMs - (Date.now() - openedAt));
    super(`Circuit [${circuitName}] is OPEN — retry in ${Math.round(remainingMs / 1000)}s`);
    this.name = 'CircuitOpenError';
  }
}
