import { getTracer } from './index';
import { SpanStatusCode } from '@opentelemetry/api';

interface PrismaQueryEvent {
  timestamp: Date;
  query: string;
  params: string;
  duration: number;
  target: string;
}

function sanitizeQuery(query: string): string {
  return query.replace(/\s+/g, ' ').trim().substring(0, 200);
}

function extractOperation(query: string): string {
  const trimmed = query.trim().toUpperCase();
  if (trimmed.startsWith('SELECT')) return 'SELECT';
  if (trimmed.startsWith('INSERT')) return 'INSERT';
  if (trimmed.startsWith('UPDATE')) return 'UPDATE';
  if (trimmed.startsWith('DELETE')) return 'DELETE';
  if (trimmed.startsWith('CREATE')) return 'CREATE';
  if (trimmed.startsWith('ALTER')) return 'ALTER';
  if (trimmed.startsWith('DROP')) return 'DROP';
  return 'OTHER';
}

export function instrumentPrisma(prisma: { $on: (event: string, cb: (e: PrismaQueryEvent) => void) => void; $extends: (ext: unknown) => unknown }) {
  const tracer = getTracer('prisma');

  prisma.$on('query' as never, (e: PrismaQueryEvent) => {
    const span = tracer.startSpan(`prisma.${extractOperation(e.query)}`, {
      attributes: {
        'db.system': 'postgresql',
        'db.operation': extractOperation(e.query),
        'db.statement': sanitizeQuery(e.query),
        'db.duration_ms': e.duration,
      },
    });

    // End span asynchronously on next tick to capture full duration
    Promise.resolve().then(() => {
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
    });
  });

  return prisma;
}
