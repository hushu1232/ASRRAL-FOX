export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error } from '@/lib/api-response';
import { withAuth } from '@/lib/auth/middleware';
import { AppError } from '@/lib/errors';
import { validateParts, getDisabledPartIds } from '@/lib/part-rule-engine';
import type { PartRule } from '@/types/part';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:parts-validate');

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { equippedPartIds, newPartId } = body as {
      equippedPartIds?: string[];
      newPartId?: string;
    };

    if (!Array.isArray(equippedPartIds) || !newPartId) {
      return error(new AppError(400, 'equippedPartIds 和 newPartId 为必填项', 'BAD_REQUEST'));
    }

    const [rules, part, allParts] = await Promise.all([
      prisma.partRule.findMany({
        select: { id: true, ruleType: true, partAId: true, partBId: true, message: true },
      }),
      prisma.part.findUnique({ where: { id: newPartId }, select: { id: true, name: true } }),
      prisma.part.findMany({ select: { id: true } }),
    ]);

    if (!part) {
      return error(new AppError(404, '部件不存在', 'NOT_FOUND'));
    }

    const typedRules = rules as unknown as PartRule[];
    const violations = validateParts(equippedPartIds, newPartId, typedRules);

    const allPartIds = allParts.map(p => p.id);
    const disabledIds = getDisabledPartIds(equippedPartIds, allPartIds, typedRules);

    return success({
      partId: newPartId,
      partName: part.name,
      canEquip: violations.length === 0,
      violations,
      disabledPartIds: Array.from(disabledIds),
    });
  } catch (e) {
    log.error({ err: e }, 'Validation error');
    return error('验证失败');
  }
});
