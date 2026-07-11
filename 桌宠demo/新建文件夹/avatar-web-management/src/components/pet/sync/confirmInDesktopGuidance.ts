import type { AlifeLocalHealthState, AlifeLocalHealthView } from '@/lib/alife/local-health';

export type ConfirmHealthGuidanceKey =
  | 'healthGuidance.reachable'
  | 'healthGuidance.unreachable'
  | 'healthGuidance.authRequired'
  | 'healthGuidance.invalidResponse'
  | 'healthGuidance.error'
  | 'healthGuidance.notConfigured';

const HEALTH_GUIDANCE_KEYS: Record<AlifeLocalHealthState, ConfirmHealthGuidanceKey> = {
  reachable: 'healthGuidance.reachable',
  unreachable: 'healthGuidance.unreachable',
  authRequired: 'healthGuidance.authRequired',
  invalidResponse: 'healthGuidance.invalidResponse',
  error: 'healthGuidance.error',
  notConfigured: 'healthGuidance.notConfigured',
};

/**
 * Maps advisory local-health state to a confirm-in-desktop guidance i18n key.
 * Returns null when health is absent so the UI does not invent reachability.
 */
export function getConfirmHealthGuidanceKey(
  health: AlifeLocalHealthView | null | undefined,
): ConfirmHealthGuidanceKey | null {
  if (!health) {
    return null;
  }

  return HEALTH_GUIDANCE_KEYS[health.state] ?? null;
}
