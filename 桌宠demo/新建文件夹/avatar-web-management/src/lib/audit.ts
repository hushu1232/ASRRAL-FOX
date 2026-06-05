import { NextRequest } from 'next/server';
import { getPrisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';

const log = createLogger('audit');

export interface AuditLogParams {
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  req?: NextRequest;
  workspaceId?: string;
}

function extractIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || '127.0.0.1';
}

/**
 * 统一审计日志写入入口。
 * 所有敏感操作（登录、CRUD、角色变更等）必须调用此函数。
 * 采用 fire-and-forget 模式，写入失败不阻塞主流程。
 */
export async function logAudit(params: AuditLogParams): Promise<void> {
  try {
    const prisma = getPrisma();
    await prisma.auditLog.create({
      data: {
        userId: params.userId || null,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId || null,
        ipAddress: params.req ? extractIp(params.req) : null,
        userAgent: params.req?.headers.get('user-agent') || null,
        details: params.details ? JSON.stringify(params.details) : null,
      },
    });
  } catch (err) {
    log.error({ err, auditAction: params.action }, 'Audit log write failed');
  }
}
