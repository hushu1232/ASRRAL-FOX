export const runtime = 'nodejs';

import prisma from '@/lib/prisma';
import { success, error } from '@/lib/api-response';
import { withAuth } from '@/lib/auth/middleware';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:rules');

export const GET = withAuth(async () => {
  try {
    const rules = await prisma.partRule.findMany({
      select: { id: true, ruleType: true, partAId: true, partBId: true, message: true },
    });
    return success(rules);
  } catch (e) {
    log.error({ err: e }, 'Failed to fetch rules');
    return error('获取规则失败');
  }
});
