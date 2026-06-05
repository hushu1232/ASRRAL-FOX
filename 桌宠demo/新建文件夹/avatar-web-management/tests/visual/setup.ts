/**
 * Visual regression test setup — extends Jest with toMatchImageSnapshot.
 * Requires Next.js dev server running on BASE_URL (default http://localhost:3000).
 *
 * Usage: npm run test:visual
 * First run creates baseline snapshots in __image_snapshots__/.
 * Subsequent runs compare against baselines.
 */

import { toMatchImageSnapshot } from 'jest-image-snapshot';
import type { MatchImageSnapshotOptions } from 'jest-image-snapshot';

expect.extend({ toMatchImageSnapshot });

const defaultOptions: MatchImageSnapshotOptions = {
  customDiffConfig: { threshold: 0.1 },
  failureThreshold: 0.005, // 0.5% pixel difference allowed
  failureThresholdType: 'percent',
  blur: 0,
  comparisonMethod: 'ssim',
  storeReceivedOnFailure: true,
  customSnapshotsDir: __dirname + '/__image_snapshots__',
  customDiffDir: __dirname + '/__image_diffs__',
};

// Store on global so test files can access
(global as unknown as Record<string, unknown>).visualRegressionOptions = defaultOptions;
