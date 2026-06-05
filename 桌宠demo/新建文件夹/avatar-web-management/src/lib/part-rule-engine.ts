// 部件共存规则引擎
// 检查装配操作是否违反互斥/依赖规则

import type { PartRule } from '@/types/part';

export interface RuleViolation {
  ruleId: string;
  ruleType: 'mutex' | 'dependency';
  message: string;
  conflictingPartId: string;
}

/**
 * 验证装配新部件是否与已有部件冲突
 * @param equippedPartIds 当前已装备的部件ID列表
 * @param newPartId 要装配的新部件ID
 * @param allRules 所有规则
 * @returns 冲突列表，空数组表示可以装配
 */
export function validateParts(
  equippedPartIds: string[],
  newPartId: string,
  allRules: PartRule[]
): RuleViolation[] {
  const violations: RuleViolation[] = [];
  const equippedSet = new Set(equippedPartIds);

  for (const rule of allRules) {
    // 检查规则是否涉及新部件
    const isNewPartA = rule.part_a_id === newPartId;
    const isNewPartB = rule.part_b_id === newPartId;
    if (!isNewPartA && !isNewPartB) continue;

    if (rule.rule_type === 'mutex') {
      // 互斥：新部件与已有的另一方冲突
      const otherId = isNewPartA ? rule.part_b_id : rule.part_a_id;
      if (equippedSet.has(otherId)) {
        violations.push({
          ruleId: rule.id,
          ruleType: 'mutex',
          message: rule.message || '该部件与已装备部件不兼容',
          conflictingPartId: otherId,
        });
      }
    } else if (rule.rule_type === 'dependency') {
      // 依赖：新部件 (part_a) 需要 part_b 已装备
      if (isNewPartA) {
        const requiredId = rule.part_b_id;
        if (!equippedSet.has(requiredId)) {
          violations.push({
            ruleId: rule.id,
            ruleType: 'dependency',
            message: rule.message || '该部件需要先装配依赖部件',
            conflictingPartId: requiredId,
          });
        }
      }
      // 如果要移除 part_b，检查是否有依赖它的部件存在
      // (此处只做装配验证，移除在 detachPart 时处理)
    }
  }

  return violations;
}

/**
 * 根据已有装备列表，找出所有不可用的部件ID
 * @param equippedPartIds 当前已装备的部件
 * @param allPartIds 所有可用部件的ID
 * @param allRules 所有规则
 * @returns 不可用的部件ID集合
 */
export function getDisabledPartIds(
  equippedPartIds: string[],
  allPartIds: string[],
  allRules: PartRule[]
): Set<string> {
  const disabled = new Set<string>();

  for (const candidateId of allPartIds) {
    if (equippedPartIds.includes(candidateId)) continue; // 已装备的不禁用
    const violations = validateParts(equippedPartIds, candidateId, allRules);
    if (violations.length > 0) {
      disabled.add(candidateId);
    }
  }

  return disabled;
}

/**
 * 找出特定已装备部件的冲突原因（用于显示提示）
 */
export function getDisabledReason(
  partId: string,
  equippedPartIds: string[],
  allRules: PartRule[]
): string | null {
  const violations = validateParts(equippedPartIds, partId, allRules);
  return violations.length > 0 ? violations[0].message : null;
}
