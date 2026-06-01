import pino from 'pino';
import { trace } from '@opentelemetry/api';
import { getRequestId } from '@/lib/request-context';

const isProduction = process.env.NODE_ENV === 'production';

function getTraceIds() {
  try {
    const span = trace.getActiveSpan();
    if (!span) return {};
    const ctx = span.spanContext();
    if (!ctx.traceId || !ctx.spanId) return {};
    return { traceId: ctx.traceId, spanId: ctx.spanId };
  } catch {
    return {};
  }
}

const baseLogger = pino({
  level: process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug'),
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino/file',
          options: { destination: 1 },
        },
      }),
  mixin() {
    const requestId = getRequestId();
    const traceIds = getTraceIds();
    return { ...(requestId ? { requestId } : {}), ...traceIds };
  },
  serializers: {
    err: pino.stdSerializers.err,
    password: () => '[REDACTED]',
    token: () => '[REDACTED]',
  },
});

export function createLogger(name: string) {
  return baseLogger.child({ name });
}

export { baseLogger as logger };
