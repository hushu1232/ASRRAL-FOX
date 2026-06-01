import { validateParts, getDisabledPartIds, getDisabledReason } from '@/lib/part-rule-engine';
import type { PartRule } from '@/types/part';

const makeRule = (overrides: Partial<PartRule> = {}): PartRule => ({
  id: 'r1',
  rule_type: 'mutex',
  part_a_id: 'part_a',
  part_b_id: 'part_b',
  message: '冲突',
  ...overrides,
});

describe('validateParts', () => {
  it('returns empty when no rules exist', () => {
    const result = validateParts(['part_a'], 'part_x', []);
    expect(result).toHaveLength(0);
  });

  it('returns empty when rule does not involve new part', () => {
    const rules = [makeRule({ part_a_id: 'part_x', part_b_id: 'part_y' })];
    const result = validateParts(['part_a'], 'part_b', rules);
    expect(result).toHaveLength(0);
  });

  it('detects mutex conflict when conflicting part is equipped', () => {
    const rules = [makeRule({ rule_type: 'mutex', part_a_id: 'new_part', part_b_id: 'equipped_part' })];
    const result = validateParts(['equipped_part'], 'new_part', rules);
    expect(result).toHaveLength(1);
    expect(result[0].ruleType).toBe('mutex');
    expect(result[0].conflictingPartId).toBe('equipped_part');
  });

  it('detects mutex conflict in reverse direction', () => {
    const rules = [makeRule({ rule_type: 'mutex', part_a_id: 'equipped_part', part_b_id: 'new_part' })];
    const result = validateParts(['equipped_part'], 'new_part', rules);
    expect(result).toHaveLength(1);
    expect(result[0].conflictingPartId).toBe('equipped_part');
  });

  it('no mutex when conflicting part is not equipped', () => {
    const rules = [makeRule({ rule_type: 'mutex', part_a_id: 'new_part', part_b_id: 'other_part' })];
    const result = validateParts(['equipped_part'], 'new_part', rules);
    expect(result).toHaveLength(0);
  });

  it('detects dependency violation when required part missing', () => {
    const rules = [makeRule({
      rule_type: 'dependency',
      part_a_id: 'new_part',
      part_b_id: 'required_part',
      message: '需要先装备 required_part',
    })];
    const result = validateParts(['other_part'], 'new_part', rules);
    expect(result).toHaveLength(1);
    expect(result[0].ruleType).toBe('dependency');
    expect(result[0].conflictingPartId).toBe('required_part');
    expect(result[0].message).toBe('需要先装备 required_part');
  });

  it('no dependency violation when required part is equipped', () => {
    const rules = [makeRule({
      rule_type: 'dependency',
      part_a_id: 'new_part',
      part_b_id: 'required_part',
    })];
    const result = validateParts(['required_part'], 'new_part', rules);
    expect(result).toHaveLength(0);
  });

  it('dependency only applies to part_a (not reversed)', () => {
    const rules = [makeRule({
      rule_type: 'dependency',
      part_a_id: 'base_part',
      part_b_id: 'dependent_part',
    })];
    // Equipping 'dependent_part' does NOT require 'base_part'
    const result = validateParts(['other'], 'dependent_part', rules);
    expect(result).toHaveLength(0);
  });

  it('multiple rules can all trigger', () => {
    const rules = [
      makeRule({ id: 'r1', rule_type: 'mutex', part_a_id: 'new_part', part_b_id: 'equipped_a', message: '冲突1' }),
      makeRule({ id: 'r2', rule_type: 'mutex', part_a_id: 'new_part', part_b_id: 'equipped_b', message: '冲突2' }),
    ];
    const result = validateParts(['equipped_a', 'equipped_b'], 'new_part', rules);
    expect(result).toHaveLength(2);
  });

  it('detects mutex when new part is part_b (reverse)', () => {
    const rules = [makeRule({ rule_type: 'mutex', part_a_id: 'equipped_part', part_b_id: 'new_part' })];
    const result = validateParts(['equipped_part'], 'new_part', rules);
    expect(result).toHaveLength(1);
    expect(result[0].conflictingPartId).toBe('equipped_part');
  });

  it('dependency uses default message when rule.message is null', () => {
    const rules = [makeRule({
      rule_type: 'dependency',
      part_a_id: 'new_part',
      part_b_id: 'required_part',
      message: null,
    })];
    const result = validateParts(['other'], 'new_part', rules);
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('该部件需要先装配依赖部件');
  });

  it('mutex uses default message when rule.message is null', () => {
    const rules = [makeRule({ rule_type: 'mutex', part_a_id: 'new_part', part_b_id: 'equipped_part', message: null })];
    const result = validateParts(['equipped_part'], 'new_part', rules);
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('该部件与已装备部件不兼容');
  });

  it('mutex uses default message when rule.message is empty string', () => {
    const rules = [makeRule({ rule_type: 'mutex', part_a_id: 'new_part', part_b_id: 'equipped_part', message: '' })];
    const result = validateParts(['equipped_part'], 'new_part', rules);
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('该部件与已装备部件不兼容');
  });
});

describe('getDisabledPartIds', () => {
  const allPartIds = ['part_a', 'part_b', 'part_c', 'part_d'];

  it('returns disabled parts ids', () => {
    const rules = [makeRule({ rule_type: 'mutex', part_a_id: 'part_c', part_b_id: 'part_a' })];
    const disabled = getDisabledPartIds(['part_a'], allPartIds, rules);
    expect(disabled.has('part_c')).toBe(true);
    expect(disabled.has('part_b')).toBe(false);
    expect(disabled.has('part_d')).toBe(false);
  });

  it('does not disable already equipped parts', () => {
    const rules = [makeRule({ rule_type: 'mutex', part_a_id: 'part_a', part_b_id: 'part_b' })];
    const disabled = getDisabledPartIds(['part_a', 'part_b'], allPartIds, rules);
    expect(disabled.has('part_a')).toBe(false);
  });

  it('returns empty set when no rules', () => {
    const disabled = getDisabledPartIds(['part_a'], allPartIds, []);
    expect(disabled.size).toBe(0);
  });
});

describe('getDisabledReason', () => {
  it('returns message for disabled part', () => {
    const rules = [makeRule({ rule_type: 'mutex', part_a_id: 'part_x', part_b_id: 'part_a', message: '不能与 part_a 共存' })];
    const reason = getDisabledReason('part_x', ['part_a'], rules);
    expect(reason).toBe('不能与 part_a 共存');
  });

  it('returns null for compatible part', () => {
    const rules = [makeRule({ rule_type: 'mutex', part_a_id: 'part_x', part_b_id: 'part_a' })];
    const reason = getDisabledReason('part_b', ['part_a'], rules);
    expect(reason).toBeNull();
  });
});
