import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from '@opentelemetry/semantic-conventions';
import { ParentBasedSampler, TraceIdRatioBasedSampler, AlwaysOnSampler } from '@opentelemetry/sdk-trace-base';
import { trace, SpanStatusCode, Span } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { createLogger } from '@/lib/logger';

const log = createLogger('telemetry');

let sdk: NodeSDK | null = null;

function getSampler() {
  const samplerEnv = process.env.OTEL_TRACES_SAMPLER || 'parentbased_always_on';
  const ratio = parseFloat(process.env.OTEL_TRACES_SAMPLER_ARG || '1.0');

  if (samplerEnv === 'always_on') return new AlwaysOnSampler();
  if (samplerEnv === 'parentbased_always_on') return new ParentBasedSampler({ root: new AlwaysOnSampler() });
  if (samplerEnv === 'parentbased_traceidratio') {
    return new ParentBasedSampler({ root: new TraceIdRatioBasedSampler(ratio) });
  }
  return new ParentBasedSampler({ root: new AlwaysOnSampler() });
}

export function initTelemetry(): void {
  if (process.env.NODE_ENV === 'test') return;

  try {
    const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    const spanExporter = otlpEndpoint
      ? new OTLPTraceExporter({ url: `${otlpEndpoint}/v1/traces` })
      : new ConsoleSpanExporter();

    const resource = resourceFromAttributes({
      [SEMRESATTRS_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'avatar-web',
      [SEMRESATTRS_SERVICE_VERSION]: process.env.npm_package_version || '0.1.0',
      [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
    });

    sdk = new NodeSDK({
      resource,
      sampler: getSampler(),
      traceExporter: spanExporter,
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-http': { enabled: true },
          '@opentelemetry/instrumentation-pg': { enabled: true },
          '@opentelemetry/instrumentation-ioredis': { enabled: true },
          // Disable noisy instrumentations
          '@opentelemetry/instrumentation-fs': { enabled: false },
          '@opentelemetry/instrumentation-dns': { enabled: false },
          '@opentelemetry/instrumentation-net': { enabled: false },
        }),
      ],
    });

    sdk.start();
    log.info('OpenTelemetry tracing initialized (exporter: %s)', otlpEndpoint ? 'otlp-http' : 'console');
  } catch (err) {
    log.warn({ err }, 'OpenTelemetry initialization failed — tracing disabled');
  }
}

export async function shutdownTelemetry(): Promise<void> {
  if (sdk) {
    try {
      await sdk.shutdown();
      log.info('OpenTelemetry tracing shut down');
    } catch (err) {
      log.warn({ err }, 'OpenTelemetry shutdown error');
    }
    sdk = null;
  }
}

export function getTracer(name: string) {
  return trace.getTracer(name);
}

export async function withSpan<T>(
  name: string,
  attrs: Record<string, string | number | boolean>,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  const tracer = getTracer('avatar-web');
  const span = tracer.startSpan(name);
  for (const [key, value] of Object.entries(attrs)) {
    span.setAttribute(key, value);
  }
  try {
    const result = await fn(span);
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (err) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error)?.message });
    span.recordException(err as Error);
    throw err;
  } finally {
    span.end();
  }
}
