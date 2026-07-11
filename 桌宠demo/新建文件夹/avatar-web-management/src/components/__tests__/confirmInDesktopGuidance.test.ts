import { getConfirmHealthGuidanceKey } from '@/components/pet/sync/confirmInDesktopGuidance';
import type { AlifeLocalHealthView } from '@/lib/alife/local-health';

function health(state: AlifeLocalHealthView['state']): AlifeLocalHealthView {
  return {
    state,
    configured: state !== 'notConfigured',
    checkedAt: '2026-07-11T00:00:00.000Z',
  };
}

describe('getConfirmHealthGuidanceKey', () => {
  it('maps local health states to guidance keys without inventing reachability', () => {
    expect(getConfirmHealthGuidanceKey(health('reachable'))).toBe('healthGuidance.reachable');
    expect(getConfirmHealthGuidanceKey(health('unreachable'))).toBe('healthGuidance.unreachable');
    expect(getConfirmHealthGuidanceKey(health('authRequired'))).toBe('healthGuidance.authRequired');
    expect(getConfirmHealthGuidanceKey(health('invalidResponse'))).toBe(
      'healthGuidance.invalidResponse',
    );
    expect(getConfirmHealthGuidanceKey(health('error'))).toBe('healthGuidance.error');
    expect(getConfirmHealthGuidanceKey(health('notConfigured'))).toBe(
      'healthGuidance.notConfigured',
    );
    expect(getConfirmHealthGuidanceKey(null)).toBeNull();
    expect(getConfirmHealthGuidanceKey(undefined)).toBeNull();
  });
});
