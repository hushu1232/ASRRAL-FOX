# Pet WebBridge Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework `/dashboard/pet` into a status-first Pet/WebBridge operating console while establishing the first code-backed baseline for a unified Insta360-inspired FOXD UI component and text system.

**Architecture:** Keep `src/app/(auth)/dashboard/pet/page.tsx` as the orchestration layer for fetching, saving, exporting, and opening the asset picker. Extract focused presentational components under `src/components/pet/` and shared UI primitives under `src/components/ui/`, then wire them into the page. The first slice applies the global UI specification to the pet console only; other pages migrate later.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Ant Design 6, Tailwind utility classes, Jest, Testing Library, existing FOXD design tokens.

---

## Scope Guardrails

- Do not start, stop, or call the live Alife runtime.
- Do not call WebBridge activation or apply.
- Keep `WebBridgeMockStatusPanel` local-only; scenario switching must not call `fetch`.
- Do not redesign marketplace, assets, settings, admin, or public pages in this slice.
- Do not revive Unity runtime UX.
- Do not add a new styling framework.
- Do not introduce broad lint cleanup outside touched files.
- Use Ant Design 6 APIs: `Space vertical`, `Alert title`, `styles`, `classNames`, and `Tabs items`.

## File Structure

Create:

- `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/lib/design-system/ui-spec.ts`
  - Owns the shared type scale, component sizing, CTA geometry, and layout constants inspired by the Insta360 reference.
- `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/ui/OperationPanel.tsx`
  - A compact tokenized panel wrapper for operational cards.
- `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/ui/MetricTile.tsx`
  - Stable metric/status tile for version and state summaries.
- `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/ui/StatusChip.tsx`
  - Standard status chip mapping semantic state to Ant Design `Tag`.
- `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/pet/PetRuntimeSummary.tsx`
  - Top status strip for desktop sync state, next action, versions, and local confirmation guard.
- `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/pet/PetSetupReadiness.tsx`
  - Compact replacement for the current long setup wizard alert.
- `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/pet/PetPreviewCard.tsx`
  - Preview and identity summary extracted from the page.
- `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/pet/PetConfigEditor.tsx`
  - Basic/model configuration tabs extracted from the page.
- `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/__tests__/OperationPanel.test.tsx`
- `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/__tests__/PetRuntimeSummary.test.tsx`
- `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/__tests__/PetSetupReadiness.test.tsx`
- `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/__tests__/PetPreviewCard.test.tsx`
- `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/__tests__/PetConfigEditor.test.tsx`

Modify:

- `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/lib/design-system/index.ts`
  - Export `uiSpec`.
- `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/tests/design-system.test.ts`
  - Verify the global UI specification tokens.
- `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/app/globals.css`
  - Add CSS variables for type scale, panel surfaces, CTA dimensions, and pill radius.
- `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/pet/sync/PetSyncStatusPanel.tsx`
  - Align to `OperationPanel`, `StatusChip`, AntD 6 `Space vertical`, and cleaner error hierarchy.
- `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/pet/sync/WebBridgeMockStatusPanel.tsx`
  - Align to `OperationPanel`, `MetricTile`, `StatusChip`, and tokenized control layout.
- `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/app/(auth)/dashboard/pet/page.tsx`
  - Use `PageHeader`, `PetRuntimeSummary`, `PetSetupReadiness`, `PetPreviewCard`, and `PetConfigEditor`.
- `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/__tests__/PetConfigPageSync.test.tsx`
  - Update page integration expectations and Next navigation mocks.
- `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/__tests__/PetSyncStatusPanel.test.tsx`
  - Update assertions if markup changes while preserving behavior.
- `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/__tests__/WebBridgeMockStatusPanel.test.tsx`
  - Preserve the no-network scenario switching assertion.
- `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/messages/en.json`
- `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/messages/zh-CN.json`
- `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/messages/ja.json`
  - Add only the new pet console labels required by the extracted components.

---

### Task 1: UI System Baseline Tokens

**Files:**
- Create: `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/lib/design-system/ui-spec.ts`
- Modify: `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/lib/design-system/index.ts`
- Modify: `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/tests/design-system.test.ts`
- Modify: `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/app/globals.css`

- [ ] **Step 1: Write the failing design-system tests**

Append this block to `tests/design-system.test.ts`:

```ts
import { uiSpec } from '@/lib/design-system';

describe('FOXD UI specification', () => {
  it('defines the site-wide type scale inspired by the Insta360 reference', () => {
    expect(uiSpec.typeScale.pageTitle).toEqual({
      fontSize: '2rem',
      lineHeight: '1.15',
      fontWeight: '700',
    });
    expect(uiSpec.typeScale.cardTitle.fontSize).toBe('1rem');
    expect(uiSpec.typeScale.metadata.fontSize).toBe('0.75rem');
    expect(uiSpec.typeScale.body.lineHeight).toBe('1.55');
  });

  it('defines shared CTA and panel sizing rules', () => {
    expect(uiSpec.controls.navCtaHeight).toBe('36px');
    expect(uiSpec.controls.primaryCtaHeight).toBe('40px');
    expect(uiSpec.controls.heroCtaHeight).toBe('56px');
    expect(uiSpec.controls.pillRadius).toBe('9999px');
    expect(uiSpec.panels.radius).toBe('8px');
    expect(uiSpec.panels.gridMinWidth).toBe('220px');
  });
});
```

- [ ] **Step 2: Run the red test**

Run:

```powershell
npx jest --runInBand tests/design-system.test.ts
```

Expected: fail with `Cannot find module '@/lib/design-system'` export member `uiSpec`, or `uiSpec` is `undefined`.

- [ ] **Step 3: Create `ui-spec.ts`**

Create `src/lib/design-system/ui-spec.ts`:

```ts
export const uiSpec = {
  typeScale: {
    display: { fontSize: '2.5rem', lineHeight: '1.08', fontWeight: '700' },
    pageTitle: { fontSize: '2rem', lineHeight: '1.15', fontWeight: '700' },
    sectionTitle: { fontSize: '1.25rem', lineHeight: '1.25', fontWeight: '650' },
    cardTitle: { fontSize: '1rem', lineHeight: '1.35', fontWeight: '650' },
    body: { fontSize: '0.875rem', lineHeight: '1.55', fontWeight: '400' },
    metadata: { fontSize: '0.75rem', lineHeight: '1.4', fontWeight: '500' },
    button: { fontSize: '0.875rem', lineHeight: '1.2', fontWeight: '600' },
  },
  controls: {
    navCtaHeight: '36px',
    primaryCtaHeight: '40px',
    heroCtaHeight: '56px',
    pillRadius: '9999px',
    compactButtonHeight: '32px',
  },
  panels: {
    radius: '8px',
    gridMinWidth: '220px',
    densePadding: '16px',
    comfortablePadding: '20px',
  },
} as const;

export type UiSpec = typeof uiSpec;
```

- [ ] **Step 4: Export the spec**

Modify `src/lib/design-system/index.ts` to export the new file:

```ts
export * from './tokens';
export * from './css-vars';
export * from './antd-tokens';
export * from './ui-spec';
```

- [ ] **Step 5: Add global CSS variables**

Add these variables under `:root` in `src/app/globals.css`:

```css
  --ds-type-display-size: 2.5rem;
  --ds-type-display-lineHeight: 1.08;
  --ds-type-pageTitle-size: 2rem;
  --ds-type-pageTitle-lineHeight: 1.15;
  --ds-type-sectionTitle-size: 1.25rem;
  --ds-type-cardTitle-size: 1rem;
  --ds-type-body-size: 0.875rem;
  --ds-type-body-lineHeight: 1.55;
  --ds-type-metadata-size: 0.75rem;
  --ds-control-navCta-height: 36px;
  --ds-control-primaryCta-height: 40px;
  --ds-control-heroCta-height: 56px;
  --ds-control-pillRadius: 9999px;
  --ds-panel-radius: 8px;
  --ds-panel-gridMinWidth: 220px;
  --ds-panel-densePadding: 16px;
  --ds-panel-comfortablePadding: 20px;
```

- [ ] **Step 6: Run the green test**

Run:

```powershell
npx jest --runInBand tests/design-system.test.ts
```

Expected: pass.

- [ ] **Step 7: Commit**

```powershell
git add "妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/lib/design-system/ui-spec.ts" "妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/lib/design-system/index.ts" "妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/tests/design-system.test.ts" "妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/app/globals.css"
git commit -m "feat: add FOXD UI specification tokens"
```

---

### Task 2: Shared Operational UI Primitives

**Files:**
- Create: `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/ui/OperationPanel.tsx`
- Create: `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/ui/MetricTile.tsx`
- Create: `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/ui/StatusChip.tsx`
- Create: `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/__tests__/OperationPanel.test.tsx`

- [ ] **Step 1: Write the failing primitive tests**

Create `src/components/__tests__/OperationPanel.test.tsx`:

```tsx
/**
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { App } from 'antd';
import type { ReactNode } from 'react';
import OperationPanel from '@/components/ui/OperationPanel';
import MetricTile from '@/components/ui/MetricTile';
import StatusChip from '@/components/ui/StatusChip';

function Wrapper({ children }: { children: ReactNode }) {
  return <App>{children}</App>;
}

describe('operational UI primitives', () => {
  it('renders an operation panel with title, extra content, and tokenized body', () => {
    render(
      <OperationPanel title="Runtime sync" extra={<button type="button">Refresh</button>}>
        <p>Desktop is online</p>
      </OperationPanel>,
      { wrapper: Wrapper },
    );

    expect(screen.getByText('Runtime sync')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeDefined();
    expect(screen.getByText('Desktop is online')).toBeDefined();
  });

  it('renders metric tiles with stable labels and values', () => {
    render(<MetricTile label="Web version" value="12" detail="Published" />, {
      wrapper: Wrapper,
    });

    expect(screen.getByText('Web version')).toBeDefined();
    expect(screen.getByText('12')).toBeDefined();
    expect(screen.getByText('Published')).toBeDefined();
  });

  it('renders status chips with semantic labels', () => {
    render(<StatusChip tone="warning">Local confirmation</StatusChip>, { wrapper: Wrapper });

    expect(screen.getByText('Local confirmation')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the red test**

Run:

```powershell
npx jest --runInBand src/components/__tests__/OperationPanel.test.tsx
```

Expected: fail because `OperationPanel`, `MetricTile`, and `StatusChip` do not exist.

- [ ] **Step 3: Create `OperationPanel`**

Create `src/components/ui/OperationPanel.tsx`:

```tsx
import type { CSSProperties, ReactNode } from 'react';
import { Card } from 'antd';

interface OperationPanelProps {
  title: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export default function OperationPanel({
  title,
  extra,
  children,
  className,
  style,
}: OperationPanelProps) {
  return (
    <Card
      title={title}
      extra={extra}
      className={className}
      style={{
        borderRadius: 'var(--ds-panel-radius)',
        background: 'var(--bg-card)',
        borderColor: 'var(--border-subtle)',
        ...style,
      }}
      styles={{
        header: {
          minHeight: 52,
          borderColor: 'var(--border-subtle)',
        },
        body: {
          background: 'var(--bg-card)',
          padding: 'var(--ds-panel-comfortablePadding, 20px)',
        },
      }}
    >
      {children}
    </Card>
  );
}
```

- [ ] **Step 4: Create `MetricTile`**

Create `src/components/ui/MetricTile.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Typography } from 'antd';

const { Text } = Typography;

interface MetricTileProps {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
}

export default function MetricTile({ label, value, detail }: MetricTileProps) {
  return (
    <div
      style={{
        minHeight: 86,
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--ds-panel-radius)',
        background: 'var(--bg-card-hover)',
        padding: 14,
      }}
    >
      <Text
        style={{
          display: 'block',
          fontSize: 'var(--ds-type-metadata-size)',
          color: 'var(--text-secondary)',
          lineHeight: 1.4,
        }}
      >
        {label}
      </Text>
      <div
        style={{
          marginTop: 6,
          fontSize: 'var(--ds-type-cardTitle-size)',
          fontWeight: 650,
          lineHeight: 1.35,
          color: 'var(--text-primary)',
        }}
      >
        {value}
      </div>
      {detail && (
        <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
          {detail}
        </Text>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create `StatusChip`**

Create `src/components/ui/StatusChip.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Tag } from 'antd';

export type StatusChipTone = 'neutral' | 'success' | 'warning' | 'error' | 'processing';

const TONE_COLORS: Record<StatusChipTone, string> = {
  neutral: 'default',
  success: 'success',
  warning: 'warning',
  error: 'error',
  processing: 'processing',
};

interface StatusChipProps {
  tone: StatusChipTone;
  children: ReactNode;
}

export default function StatusChip({ tone, children }: StatusChipProps) {
  return (
    <Tag
      color={TONE_COLORS[tone]}
      style={{
        borderRadius: 'var(--ds-control-pillRadius)',
        fontWeight: 600,
        marginInlineEnd: 0,
      }}
    >
      {children}
    </Tag>
  );
}
```

- [ ] **Step 6: Run the green test**

Run:

```powershell
npx jest --runInBand src/components/__tests__/OperationPanel.test.tsx
```

Expected: pass.

- [ ] **Step 7: Commit**

```powershell
git add "妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/ui/OperationPanel.tsx" "妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/ui/MetricTile.tsx" "妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/ui/StatusChip.tsx" "妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/__tests__/OperationPanel.test.tsx"
git commit -m "feat: add operational UI primitives"
```

---

### Task 3: Pet Runtime Summary

**Files:**
- Create: `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/pet/PetRuntimeSummary.tsx`
- Create: `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/__tests__/PetRuntimeSummary.test.tsx`

- [ ] **Step 1: Write the failing runtime summary tests**

Create `src/components/__tests__/PetRuntimeSummary.test.tsx`:

```tsx
/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { App } from 'antd';
import type { ReactNode } from 'react';
import PetRuntimeSummary from '@/components/pet/PetRuntimeSummary';
import type { DesktopSyncStatus } from '@/lib/webbridge/sync-status';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

function Wrapper({ children }: { children: ReactNode }) {
  return <App>{children}</App>;
}

function createStatus(overrides: Partial<DesktopSyncStatus> = {}): DesktopSyncStatus {
  return {
    desktopConnection: 'online',
    packageState: 'staged',
    summaryKind: 'localConfirmationRequired',
    primaryAction: 'confirmInDesktop',
    isUpToDate: false,
    webConfigVersion: 12,
    desktopKnownVersion: 12,
    desktopAppliedVersion: 11,
    requiresLocalConfirmation: true,
    lastSyncAt: '2026-06-27T08:00:00.000Z',
    lastAppliedAt: null,
    lastError: null,
    errorMessage: null,
    milestones: [],
    ...overrides,
  };
}

describe('PetRuntimeSummary', () => {
  it('surfaces current state, next action, versions, and local confirmation guard', () => {
    render(
      <PetRuntimeSummary status={createStatus()} loading={false} onRefresh={jest.fn()} />,
      { wrapper: Wrapper },
    );

    expect(screen.getByText('runtimeSummary.title')).toBeDefined();
    expect(screen.getByText('syncStatus.summary.localConfirmationRequired')).toBeDefined();
    expect(screen.getByText('runtimeSummary.nextAction.confirmInDesktop')).toBeDefined();
    expect(screen.getByText('12')).toBeDefined();
    expect(screen.getByText('11')).toBeDefined();
    expect(screen.getByText('syncStatus.required')).toBeDefined();
  });

  it('offers check-again action when the primary action is refreshable', () => {
    const onRefresh = jest.fn();
    render(
      <PetRuntimeSummary
        status={createStatus({ primaryAction: 'checkAgain', summaryKind: 'desktopOffline' })}
        loading={false}
        onRefresh={onRefresh}
      />,
      { wrapper: Wrapper },
    );

    fireEvent.click(screen.getByRole('button', { name: 'syncStatus.action.checkAgain' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('shows an unavailable summary when status is missing', () => {
    render(<PetRuntimeSummary status={null} loading={false} onRefresh={jest.fn()} />, {
      wrapper: Wrapper,
    });

    expect(screen.getByText('runtimeSummary.unavailable')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the red test**

Run:

```powershell
npx jest --runInBand src/components/__tests__/PetRuntimeSummary.test.tsx
```

Expected: fail because `PetRuntimeSummary` does not exist.

- [ ] **Step 3: Create `PetRuntimeSummary`**

Create `src/components/pet/PetRuntimeSummary.tsx`:

```tsx
'use client';

import { Button, Space, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import MetricTile from '@/components/ui/MetricTile';
import OperationPanel from '@/components/ui/OperationPanel';
import StatusChip, { type StatusChipTone } from '@/components/ui/StatusChip';
import type { DesktopPrimaryAction, DesktopSummaryKind, DesktopSyncStatus } from '@/lib/webbridge/sync-status';

const { Text } = Typography;

interface PetRuntimeSummaryProps {
  status: DesktopSyncStatus | null;
  loading: boolean;
  onRefresh: () => void;
}

const SUMMARY_TONES: Record<DesktopSummaryKind, StatusChipTone> = {
  unknown: 'neutral',
  desktopOffline: 'warning',
  pendingPull: 'processing',
  localConfirmationRequired: 'warning',
  upToDate: 'success',
  failed: 'error',
};

export default function PetRuntimeSummary({
  status,
  loading,
  onRefresh,
}: PetRuntimeSummaryProps) {
  const tPet = useTranslations('pet');
  const tSync = useTranslations('pet.syncStatus');

  if (!status) {
    return (
      <OperationPanel
        title={tPet('runtimeSummary.title')}
        extra={<RefreshAction loading={loading} onRefresh={onRefresh} label={tSync('action.checkAgain')} />}
      >
        <Text type="secondary">{tPet('runtimeSummary.unavailable')}</Text>
      </OperationPanel>
    );
  }

  return (
    <OperationPanel
      title={
        <Space size="small" wrap>
          <span>{tPet('runtimeSummary.title')}</span>
          <StatusChip tone={SUMMARY_TONES[status.summaryKind]}>
            {tSync(`summary.${status.summaryKind}`)}
          </StatusChip>
        </Space>
      }
      extra={renderPrimaryAction(status.primaryAction, loading, onRefresh, tSync)}
    >
      <Space vertical size="middle" style={{ width: '100%' }}>
        <div>
          <Text type="secondary">{tPet('runtimeSummary.nextAction.label')}</Text>
          <div style={{ marginTop: 4, color: 'var(--text-primary)', fontWeight: 650 }}>
            {tPet(`runtimeSummary.nextAction.${status.primaryAction}`)}
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns: 'repeat(auto-fit, minmax(var(--ds-panel-gridMinWidth), 1fr))',
          }}
        >
          <MetricTile label={tSync('webVersion')} value={status.webConfigVersion} />
          <MetricTile
            label={tSync('desktopAppliedVersion')}
            value={status.desktopAppliedVersion ?? tSync('notApplied')}
          />
          <MetricTile
            label={tSync('localConfirmation')}
            value={status.requiresLocalConfirmation ? tSync('required') : tSync('notRequired')}
          />
          <MetricTile label={tSync('lastSyncAt')} value={formatDate(status.lastSyncAt, tSync)} />
        </div>
      </Space>
    </OperationPanel>
  );
}

function renderPrimaryAction(
  action: DesktopPrimaryAction,
  loading: boolean,
  onRefresh: () => void,
  t: (key: string) => string,
) {
  if (action === 'checkAgain') {
    return <RefreshAction loading={loading} onRefresh={onRefresh} label={t('action.checkAgain')} />;
  }

  return null;
}

function RefreshAction({
  loading,
  onRefresh,
  label,
}: {
  loading: boolean;
  onRefresh: () => void;
  label: string;
}) {
  return (
    <Button icon={<ReloadOutlined />} loading={loading} onClick={onRefresh}>
      {label}
    </Button>
  );
}

function formatDate(value: Date | number | string | null, t: (key: string) => string): string {
  if (value === null) {
    return t('never');
  }

  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return t('never');
  }

  return date.toLocaleString();
}
```

- [ ] **Step 4: Add runtime summary i18n keys**

Add this object under the existing `pet` object in `messages/en.json`, `messages/zh-CN.json`, and `messages/ja.json`:

```json
"runtimeSummary": {
  "title": "Runtime control",
  "unavailable": "Runtime sync status is unavailable. Check again after the web service is ready.",
  "nextAction": {
    "label": "Next action",
    "none": "No action required",
    "checkAgain": "Check desktop runtime status again",
    "confirmInDesktop": "Confirm the staged update inside Alife",
    "viewDetails": "Review the sync details before retrying"
  }
}
```

- [ ] **Step 5: Run the green test**

Run:

```powershell
npx jest --runInBand src/components/__tests__/PetRuntimeSummary.test.tsx
```

Expected: pass.

- [ ] **Step 6: Commit**

```powershell
git add "妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/pet/PetRuntimeSummary.tsx" "妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/__tests__/PetRuntimeSummary.test.tsx" "妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/messages/en.json" "妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/messages/zh-CN.json" "妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/messages/ja.json"
git commit -m "feat: add pet runtime summary"
```

---

### Task 4: Pet Setup Readiness Strip

**Files:**
- Create: `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/pet/PetSetupReadiness.tsx`
- Create: `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/__tests__/PetSetupReadiness.test.tsx`

- [ ] **Step 1: Write the failing readiness tests**

Create `src/components/__tests__/PetSetupReadiness.test.tsx`:

```tsx
/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { App } from 'antd';
import type { ReactNode } from 'react';
import PetSetupReadiness from '@/components/pet/PetSetupReadiness';

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string) => key;
    t.rich = (key: string) => key;
    return t;
  },
}));

function Wrapper({ children }: { children: ReactNode }) {
  return <App>{children}</App>;
}

describe('PetSetupReadiness', () => {
  it('renders the compact setup readiness gates', () => {
    render(<PetSetupReadiness current={4} onDismiss={jest.fn()} />, { wrapper: Wrapper });

    expect(screen.getByText('wizard.title')).toBeDefined();
    expect(screen.getByText('wizard.step1Title')).toBeDefined();
    expect(screen.getByText('wizard.step5Title')).toBeDefined();
    expect(screen.getByText('wizard.step6Title')).toBeDefined();
  });

  it('calls onDismiss from the skip action', () => {
    const onDismiss = jest.fn();
    render(<PetSetupReadiness current={2} onDismiss={onDismiss} />, { wrapper: Wrapper });

    fireEvent.click(screen.getByRole('button', { name: 'wizard.skip' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the red test**

Run:

```powershell
npx jest --runInBand src/components/__tests__/PetSetupReadiness.test.tsx
```

Expected: fail because `PetSetupReadiness` does not exist.

- [ ] **Step 3: Create `PetSetupReadiness`**

Create `src/components/pet/PetSetupReadiness.tsx`:

```tsx
'use client';

import { Alert, Button, Steps } from 'antd';
import {
  ApiOutlined,
  CheckCircleOutlined,
  DownloadOutlined,
  KeyOutlined,
  PlayCircleOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';

interface PetSetupReadinessProps {
  current: number;
  onDismiss: () => void;
}

export default function PetSetupReadiness({ current, onDismiss }: PetSetupReadinessProps) {
  const t = useTranslations('pet');

  return (
    <Alert
      type="info"
      showIcon
      title={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span style={{ color: 'var(--text-primary)', fontWeight: 650 }}>{t('wizard.title')}</span>
          <Button size="small" type="text" onClick={onDismiss}>
            {t('wizard.skip')}
          </Button>
        </div>
      }
      description={
        <Steps
          size="small"
          responsive
          current={current}
          className="mt-3"
          items={[
            { title: t('wizard.step1Title'), description: t.rich('wizard.step1Desc', { link: (chunks) => chunks }), icon: <DownloadOutlined /> },
            { title: t('wizard.step2Title'), description: t('wizard.step2Desc'), icon: <KeyOutlined /> },
            { title: t('wizard.step3Title'), description: t('wizard.step3Desc'), icon: <RobotOutlined /> },
            { title: t('wizard.step4Title'), description: t('wizard.step4Desc'), icon: <PlayCircleOutlined /> },
            { title: t('wizard.step5Title'), description: t('wizard.step5Desc'), icon: <ApiOutlined /> },
            { title: t('wizard.step6Title'), description: t('wizard.step6Desc'), icon: <CheckCircleOutlined /> },
          ]}
        />
      }
      styles={{
        root: {
          background: 'var(--bg-card)',
          borderColor: 'var(--border-subtle)',
          borderRadius: 'var(--ds-panel-radius)',
        },
      }}
    />
  );
}
```

- [ ] **Step 4: Run the green test**

Run:

```powershell
npx jest --runInBand src/components/__tests__/PetSetupReadiness.test.tsx src/components/__tests__/antd6DeprecatedProps.test.ts
```

Expected: both suites pass. The deprecated props test must remain green because this component uses `Alert title` and no `Space direction`.

- [ ] **Step 5: Commit**

```powershell
git add "妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/pet/PetSetupReadiness.tsx" "妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/__tests__/PetSetupReadiness.test.tsx"
git commit -m "feat: add pet setup readiness strip"
```

---

### Task 5: Preview And Config Editor Extraction

**Files:**
- Create: `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/pet/PetPreviewCard.tsx`
- Create: `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/pet/PetConfigEditor.tsx`
- Create: `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/__tests__/PetPreviewCard.test.tsx`
- Create: `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/__tests__/PetConfigEditor.test.tsx`

- [ ] **Step 1: Write the failing preview test**

Create `src/components/__tests__/PetPreviewCard.test.tsx`:

```tsx
/**
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { App } from 'antd';
import type { ReactNode } from 'react';
import PetPreviewCard from '@/components/pet/PetPreviewCard';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) =>
    values?.name ? `${key}:${values.name}` : key,
}));

function Wrapper({ children }: { children: ReactNode }) {
  return <App>{children}</App>;
}

const config = {
  id: 'pet-1',
  pet_name: 'Nova',
  personality: 'Curious',
  backstory: 'Built for preview tests',
  animation_model: 'live2d',
  avatar_id: 'avatar-1',
  idle_timeout: 300,
  wander_interval: 30,
};

describe('PetPreviewCard', () => {
  it('shows pet identity, runtime values, and bound avatar state', () => {
    render(<PetPreviewCard config={config} />, { wrapper: Wrapper });

    expect(screen.getByText('preview.label:Nova')).toBeDefined();
    expect(screen.getByText('LIVE2D')).toBeDefined();
    expect(screen.getByText('300s')).toBeDefined();
    expect(screen.getByText('30s')).toBeDefined();
    expect(screen.getByText('preview.bound')).toBeDefined();
  });
});
```

- [ ] **Step 2: Write the failing editor test**

Create `src/components/__tests__/PetConfigEditor.test.tsx`:

```tsx
/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { App, Form } from 'antd';
import type { ReactNode } from 'react';
import PetConfigEditor, { type PetConfigEditorConfig } from '@/components/pet/PetConfigEditor';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) =>
    values?.id ? `${key}:${values.id}` : key,
}));

function Wrapper({ children }: { children: ReactNode }) {
  return <App>{children}</App>;
}

const config: PetConfigEditorConfig = {
  id: 'pet-1',
  pet_name: 'Nova',
  personality: 'Curious',
  backstory: 'Built for editor tests',
  animation_model: 'live2d',
  avatar_id: 'avatar-1',
  ffmpeg_path: 'C:\\ffmpeg\\bin\\ffmpeg.exe',
  idle_timeout: 300,
  wander_interval: 30,
};

function Harness({
  onOpenAssetPicker,
  onUnbindAvatar,
}: {
  onOpenAssetPicker: (type: string) => void;
  onUnbindAvatar: () => void;
}) {
  const [form] = Form.useForm();
  return (
    <PetConfigEditor
      form={form}
      config={config}
      onOpenAssetPicker={onOpenAssetPicker}
      onUnbindAvatar={onUnbindAvatar}
    />
  );
}

describe('PetConfigEditor', () => {
  it('renders basic and model controls and calls asset picker actions', () => {
    const onOpenAssetPicker = jest.fn();
    render(<Harness onOpenAssetPicker={onOpenAssetPicker} onUnbindAvatar={jest.fn()} />, {
      wrapper: Wrapper,
    });

    expect(screen.getByText('tabs.basic')).toBeDefined();
    expect(screen.getByText('tabs.model')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /model.pickModel/i }));
    expect(onOpenAssetPicker).toHaveBeenCalledWith('model');
  });
});
```

- [ ] **Step 3: Run the red tests**

Run:

```powershell
npx jest --runInBand src/components/__tests__/PetPreviewCard.test.tsx src/components/__tests__/PetConfigEditor.test.tsx
```

Expected: fail because `PetPreviewCard` and `PetConfigEditor` do not exist.

- [ ] **Step 4: Create `PetPreviewCard`**

Create `src/components/pet/PetPreviewCard.tsx` by moving the existing preview card markup out of `page.tsx`. Keep these rules:

```tsx
'use client';

import { Descriptions, Tag } from 'antd';
import { LinkOutlined, PictureOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import OperationPanel from '@/components/ui/OperationPanel';

export interface PetPreviewConfig {
  pet_name: string;
  animation_model: string;
  avatar_id?: string;
  idle_timeout: number;
  wander_interval: number;
}

interface PetPreviewCardProps {
  config: PetPreviewConfig | null;
}

export default function PetPreviewCard({ config }: PetPreviewCardProps) {
  const t = useTranslations('pet');
  const name = config?.pet_name || t('preview.defaultName');

  return (
    <OperationPanel title={t('preview.webPreview')}>
      <div style={{ textAlign: 'center' }}>
        <PictureOutlined style={{ fontSize: 56, color: 'var(--text-muted)', marginBottom: 16 }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>
          {t('preview.label', { name })}
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{t('preview.tip')}</p>
        {config?.avatar_id && (
          <Tag icon={<LinkOutlined />} color="purple" style={{ marginTop: 8 }}>
            {t('preview.bound')}
          </Tag>
        )}
        {config && (
          <Descriptions
            size="small"
            colon={false}
            column={1}
            style={{ marginTop: 16, textAlign: 'left' }}
            styles={{
              label: { color: 'var(--text-secondary)' },
              content: { color: 'var(--text-primary)' },
            }}
          >
            <Descriptions.Item label={t('preview.system')}>
              {config.animation_model.toUpperCase()}
            </Descriptions.Item>
            <Descriptions.Item label={t('preview.idleTimeout')}>
              {config.idle_timeout}s
            </Descriptions.Item>
            <Descriptions.Item label={t('preview.wanderInterval')}>
              {config.wander_interval}s
            </Descriptions.Item>
          </Descriptions>
        )}
      </div>
    </OperationPanel>
  );
}
```

- [ ] **Step 5: Create `PetConfigEditor`**

Create `src/components/pet/PetConfigEditor.tsx` by moving the existing form tabs out of `page.tsx`. Keep the existing field names unchanged:

```tsx
'use client';

import { Button, Form, Input, Select, Slider, Tabs, Tag } from 'antd';
import type { FormInstance } from 'antd';
import { CloudServerOutlined, LinkOutlined, PictureOutlined, ShopOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import OperationPanel from '@/components/ui/OperationPanel';

const { TextArea } = Input;

export interface PetConfigEditorConfig {
  id: string;
  pet_name: string;
  personality: string;
  backstory: string;
  animation_model: string;
  avatar_id?: string;
  ffmpeg_path?: string;
  idle_timeout: number;
  wander_interval: number;
}

interface PetConfigEditorProps {
  form: FormInstance;
  config: PetConfigEditorConfig | null;
  onOpenAssetPicker: (type: string) => void;
  onUnbindAvatar: () => void;
}

export default function PetConfigEditor({
  form,
  config,
  onOpenAssetPicker,
  onUnbindAvatar,
}: PetConfigEditorProps) {
  const t = useTranslations('pet');

  return (
    <OperationPanel title={t('title')}>
      <Form form={form} layout="vertical">
        <Tabs
          items={[
            {
              key: 'basic',
              label: t('tabs.basic'),
              children: (
                <div className="pt-4">
                  <Form.Item name="petName" label={t('basic.name')}>
                    <Input placeholder={t('basic.namePlaceholder')} />
                  </Form.Item>
                  <Form.Item name="personality" label={t('basic.personality')}>
                    <TextArea rows={3} placeholder={t('basic.personalityPlaceholder')} />
                  </Form.Item>
                  <Form.Item name="backstory" label={t('basic.backstory')}>
                    <TextArea rows={4} placeholder={t('basic.backstoryPlaceholder')} />
                  </Form.Item>
                </div>
              ),
            },
            {
              key: 'model',
              label: (
                <span>
                  <CloudServerOutlined className="mr-1" />
                  {t('tabs.model')}
                </span>
              ),
              children: (
                <div className="pt-4">
                  <Form.Item name="animationModel" label={t('model.systemLabel')}>
                    <Select
                      options={[
                        { value: 'live2d', label: t('model.live2D') },
                        { value: 'dragonbones', label: t('model.dragonBones') },
                        { value: 'vrm', label: t('model.vrm') },
                      ]}
                    />
                  </Form.Item>
                  <Form.Item label={t('model.fromMarket')}>
                    <div className="flex flex-wrap gap-2">
                      <Button icon={<ShopOutlined />} type="primary" onClick={() => window.open('/marketplace', '_blank')}>
                        {t('model.browseMarket')}
                      </Button>
                      <span className="self-center text-xs" style={{ color: 'var(--text-muted)' }}>
                        {t('model.browseMarketTip')}
                      </span>
                    </div>
                  </Form.Item>
                  <Form.Item label={t('model.bindAvatar')}>
                    <div className="flex flex-wrap gap-2">
                      <Button icon={<PictureOutlined />} onClick={() => onOpenAssetPicker('model')}>
                        {t('model.pickModel')}
                      </Button>
                      <Button onClick={() => onOpenAssetPicker('texture')}>{t('model.pickTexture')}</Button>
                      <Button onClick={() => onOpenAssetPicker('animation')}>{t('model.pickAnimation')}</Button>
                    </div>
                    {config?.avatar_id && (
                      <div className="mt-2">
                        <Tag icon={<LinkOutlined />} color="purple" closable onClose={onUnbindAvatar}>
                          {t('model.avatarId', { id: config.avatar_id })}
                        </Tag>
                      </div>
                    )}
                  </Form.Item>
                  <Form.Item name="ffmpegPath" label={t('model.ffmpegPath')}>
                    <Input placeholder="C:\\ffmpeg\\bin\\ffmpeg.exe" />
                  </Form.Item>
                  <Form.Item name="idleTimeout" label={t('model.idleTimeout')}>
                    <Slider min={60} max={1800} step={30} marks={{ 60: '1m', 300: '5m', 900: '15m', 1800: '30m' }} />
                  </Form.Item>
                  <Form.Item name="wanderInterval" label={t('model.wanderInterval')}>
                    <Slider min={5} max={120} step={5} marks={{ 5: '5s', 30: '30s', 60: '1m', 120: '2m' }} />
                  </Form.Item>
                </div>
              ),
            },
          ]}
        />
      </Form>
    </OperationPanel>
  );
}
```

- [ ] **Step 6: Run the green tests**

Run:

```powershell
npx jest --runInBand src/components/__tests__/PetPreviewCard.test.tsx src/components/__tests__/PetConfigEditor.test.tsx
```

Expected: pass.

- [ ] **Step 7: Commit**

```powershell
git add "妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/pet/PetPreviewCard.tsx" "妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/pet/PetConfigEditor.tsx" "妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/__tests__/PetPreviewCard.test.tsx" "妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/__tests__/PetConfigEditor.test.tsx"
git commit -m "refactor: extract pet preview and editor"
```

---

### Task 6: Runtime And WebBridge Panel Polish

**Files:**
- Modify: `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/pet/sync/PetSyncStatusPanel.tsx`
- Modify: `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/pet/sync/WebBridgeMockStatusPanel.tsx`
- Modify: `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/__tests__/PetSyncStatusPanel.test.tsx`
- Modify: `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/__tests__/WebBridgeMockStatusPanel.test.tsx`

- [ ] **Step 1: Run the existing tests as the safety baseline**

Run:

```powershell
npx jest --runInBand src/components/__tests__/PetSyncStatusPanel.test.tsx src/components/__tests__/WebBridgeMockStatusPanel.test.tsx src/components/__tests__/antd6DeprecatedProps.test.ts
```

Expected: pass before changes.

- [ ] **Step 2: Update `PetSyncStatusPanel` to use primitives**

Keep all existing props and behavior. Replace the outer `Card` with `OperationPanel`, replace raw `Tag` summary with `StatusChip`, and replace every `Space orientation="vertical"` with `Space vertical`.

The status tone mapping should be:

```ts
const SUMMARY_TONES: Record<DesktopSummaryKind, StatusChipTone> = {
  unknown: 'neutral',
  desktopOffline: 'warning',
  pendingPull: 'processing',
  localConfirmationRequired: 'warning',
  upToDate: 'success',
  failed: 'error',
};
```

- [ ] **Step 3: Update `WebBridgeMockStatusPanel` to use primitives**

Keep all mock scenario data, failure reasons, and no-network behavior. Replace the outer `Card` with `OperationPanel`, replace metric card inline divs with `MetricTile`, and keep scenario switching as `Segmented`.

The four metric tiles should be:

```tsx
<MetricTile label="Runtime" value="Alife .NET 9" />
<MetricTile label="Package state" value={<Tag color={scenario.tagColor}>{scenario.packageState}</Tag>} />
<MetricTile label="Next action" value={scenario.nextAction} />
<MetricTile label="Isolation" value={<Tag color="default">No live Alife calls</Tag>} />
```

- [ ] **Step 4: Run the focused panel tests**

Run:

```powershell
npx jest --runInBand src/components/__tests__/PetSyncStatusPanel.test.tsx src/components/__tests__/WebBridgeMockStatusPanel.test.tsx src/components/__tests__/antd6DeprecatedProps.test.ts
```

Expected: pass, including `switches between mock package install scenarios without network calls`.

- [ ] **Step 5: Commit**

```powershell
git add "妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/pet/sync/PetSyncStatusPanel.tsx" "妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/pet/sync/WebBridgeMockStatusPanel.tsx" "妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/__tests__/PetSyncStatusPanel.test.tsx" "妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/__tests__/WebBridgeMockStatusPanel.test.tsx"
git commit -m "refactor: align pet sync panels with UI primitives"
```

---

### Task 7: Status-First `/dashboard/pet` Integration

**Files:**
- Modify: `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/app/(auth)/dashboard/pet/page.tsx`
- Modify: `妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/__tests__/PetConfigPageSync.test.tsx`

- [ ] **Step 1: Update the page integration test first**

Modify `src/components/__tests__/PetConfigPageSync.test.tsx`:

Add a Next navigation mock above the `PetConfigPage` require:

```ts
jest.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/pet',
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
```

Add these assertions to `renders desktop sync panel after config loads`:

```ts
expect(screen.getByText('runtimeSummary.title')).toBeDefined();
expect(screen.getByText('runtimeSummary.nextAction.label')).toBeDefined();
expect(screen.getByText('preview.webPreview')).toBeDefined();
expect(screen.getByText('No live Alife calls')).toBeDefined();
```

- [ ] **Step 2: Run the red integration test**

Run:

```powershell
npx jest --runInBand src/components/__tests__/PetConfigPageSync.test.tsx
```

Expected: fail because the page has not rendered `PetRuntimeSummary`, `PageHeader`, or extracted components yet.

- [ ] **Step 3: Refactor imports in `page.tsx`**

Remove no-longer-needed imports from `page.tsx` after extraction:

```ts
Card,
Tabs,
Form,
Input,
Select,
Slider,
Descriptions,
Alert,
Steps,
RobotOutlined,
KeyOutlined,
CloudServerOutlined,
PictureOutlined,
PlayCircleOutlined,
ApiOutlined,
LinkOutlined,
ShopOutlined,
DownloadOutlined,
CheckCircleOutlined,
```

Keep:

```ts
Button,
message,
Modal,
Table,
Tag,
Spin,
ExportOutlined,
SaveOutlined,
```

Add:

```ts
import PageHeader from '@/components/layout/PageHeader';
import PetRuntimeSummary from '@/components/pet/PetRuntimeSummary';
import PetSetupReadiness from '@/components/pet/PetSetupReadiness';
import PetPreviewCard from '@/components/pet/PetPreviewCard';
import PetConfigEditor from '@/components/pet/PetConfigEditor';
```

- [ ] **Step 4: Replace the page header**

Replace the hand-rolled title/action row with:

```tsx
<PageHeader
  title={t('title')}
  subtitle={t('consoleSubtitle')}
  actions={
    <>
      <Button icon={<ExportOutlined />} onClick={handleExport}>
        {t('exportConfig')}
      </Button>
      <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
        {t('saveConfig')}
      </Button>
    </>
  }
/>
```

- [ ] **Step 5: Add the status-first layout**

Replace the top panel and wizard layout with:

```tsx
<div className="space-y-4">
  <PetRuntimeSummary status={syncStatus} loading={syncStatusLoading} onRefresh={fetchSyncStatus} />

  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
    <PetSyncStatusPanel
      status={syncStatus}
      loading={syncStatusLoading}
      onRefresh={fetchSyncStatus}
    />
    <WebBridgeMockStatusPanel />
  </div>

  {showWizard && (
    <PetSetupReadiness
      current={wizardCurrent}
      onDismiss={() => {
        setShowWizard(false);
        setWizardDismissed(true);
      }}
    />
  )}

  <div className="grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-4" style={{ minHeight: '60vh' }}>
    <PetPreviewCard config={config} />
    <PetConfigEditor
      form={form}
      config={config}
      onOpenAssetPicker={openAssetPicker}
      onUnbindAvatar={async () => {
        await apiPut('/api/pet/config', { avatarId: null });
        await fetchConfig();
      }}
    />
  </div>
</div>
```

- [ ] **Step 6: Add i18n subtitle**

Add this key under `pet` in `messages/en.json`, `messages/zh-CN.json`, and `messages/ja.json`:

```json
"consoleSubtitle": "Prepare and validate the Web pet configuration here. Alife applies staged changes only after local confirmation."
```

- [ ] **Step 7: Run the green integration test**

Run:

```powershell
npx jest --runInBand src/components/__tests__/PetConfigPageSync.test.tsx
```

Expected: pass.

- [ ] **Step 8: Run the touched component suite**

Run:

```powershell
npx jest --runInBand src/components/__tests__/PetRuntimeSummary.test.tsx src/components/__tests__/PetSetupReadiness.test.tsx src/components/__tests__/PetPreviewCard.test.tsx src/components/__tests__/PetConfigEditor.test.tsx src/components/__tests__/PetSyncStatusPanel.test.tsx src/components/__tests__/WebBridgeMockStatusPanel.test.tsx src/components/__tests__/PetConfigPageSync.test.tsx
```

Expected: all suites pass.

- [ ] **Step 9: Commit**

```powershell
git add "妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/app/(auth)/dashboard/pet/page.tsx" "妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/src/components/__tests__/PetConfigPageSync.test.tsx" "妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/messages/en.json" "妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/messages/zh-CN.json" "妗屽疇demo/鏂板缓鏂囦欢澶?avatar-web-management/messages/ja.json"
git commit -m "feat: reorganize pet WebBridge console"
```

---

### Task 8: Final Verification And Visual Review

**Files:**
- No source files are created in this task.

- [ ] **Step 1: Check formatting on touched files**

Run:

```powershell
npx prettier --check "src/lib/design-system/ui-spec.ts" "src/lib/design-system/index.ts" "tests/design-system.test.ts" "src/app/globals.css" "src/components/ui/OperationPanel.tsx" "src/components/ui/MetricTile.tsx" "src/components/ui/StatusChip.tsx" "src/components/pet/PetRuntimeSummary.tsx" "src/components/pet/PetSetupReadiness.tsx" "src/components/pet/PetPreviewCard.tsx" "src/components/pet/PetConfigEditor.tsx" "src/components/pet/sync/PetSyncStatusPanel.tsx" "src/components/pet/sync/WebBridgeMockStatusPanel.tsx" "src/app/(auth)/dashboard/pet/page.tsx" "src/components/__tests__/OperationPanel.test.tsx" "src/components/__tests__/PetRuntimeSummary.test.tsx" "src/components/__tests__/PetSetupReadiness.test.tsx" "src/components/__tests__/PetPreviewCard.test.tsx" "src/components/__tests__/PetConfigEditor.test.tsx" "src/components/__tests__/PetConfigPageSync.test.tsx" "src/components/__tests__/PetSyncStatusPanel.test.tsx" "src/components/__tests__/WebBridgeMockStatusPanel.test.tsx"
```

Expected: pass. If it fails, run the same command with `--write`, then rerun `--check`.

- [ ] **Step 2: Run focused Jest verification**

Run:

```powershell
npx jest --runInBand tests/design-system.test.ts src/components/__tests__/OperationPanel.test.tsx src/components/__tests__/PetRuntimeSummary.test.tsx src/components/__tests__/PetSetupReadiness.test.tsx src/components/__tests__/PetPreviewCard.test.tsx src/components/__tests__/PetConfigEditor.test.tsx src/components/__tests__/PetSyncStatusPanel.test.tsx src/components/__tests__/WebBridgeMockStatusPanel.test.tsx src/components/__tests__/PetConfigPageSync.test.tsx src/components/__tests__/antd6DeprecatedProps.test.ts
```

Expected: all suites pass.

- [ ] **Step 3: Run build**

Run:

```powershell
npm run build
```

Expected: build exits 0. Existing Turbopack NFT trace warnings can be reported if they remain, but they do not fail this slice.

- [ ] **Step 4: Run WebBridge preflight**

Run:

```powershell
npm run check:webbridge
```

Expected:

```text
[PASS] health HTTP 200
[PASS] login HTTP 200
[PASS] refresh HTTP 200
[PASS] pet config HTTP 200
[PASS] pet sync HTTP 200
[PASS] pet export HTTP 200
[PASS] package manifest HTTP 200
```

- [ ] **Step 5: Visual desktop review**

Start the built standalone server:

```powershell
npm run start
```

Open `/login`, sign in with the existing demo user, then inspect `/dashboard/pet` at desktop width. Confirm:

- the PageHeader title and actions do not overlap
- the runtime summary appears first
- runtime sync and package validation are visually separate
- setup readiness does not dominate the page
- preview and editor are below the operational state
- no text is clipped inside buttons, cards, tags, or step labels

- [ ] **Step 6: Visual mobile review**

Inspect `/dashboard/pet` at mobile width. Confirm:

- PageHeader actions wrap under the title
- summary tiles stack cleanly
- sync/package panels stack
- readiness steps wrap without overlap
- asset buttons stack or wrap inside the editor

- [ ] **Step 7: Final Git status**

Run:

```powershell
git status --short --branch --untracked-files=no
```

Expected: clean branch after all planned commits.

---

## Plan Self-Review

Spec coverage:

- `/dashboard/pet` first implementation slice: Tasks 3 through 7.
- Operator control-plane clarity: Tasks 3, 4, 6, and 7.
- Status-first console: Task 7.
- Insta360-inspired unified UI and text baseline: Tasks 1 and 2.
- Component boundaries: Tasks 2 through 5.
- Runtime sync and package validation separation: Tasks 6 and 7.
- Mock-only WebBridge package status: Tasks 6 and 8.
- Responsive behavior: Task 7 layout and Task 8 visual review.
- Verification: Task 8.

Type consistency:

- `DesktopSyncStatus`, `DesktopSummaryKind`, and `DesktopPrimaryAction` remain sourced from `@/lib/webbridge/sync-status`.
- `PetConfigEditorConfig` matches the current `PetConfig` shape used in `page.tsx`.
- `PetPreviewConfig` uses only preview fields from the same shape.
- UI primitive names are consistent across imports and tests.

Implementation boundaries:

- The plan creates shared primitives only where `/dashboard/pet` uses them.
- The plan does not migrate unrelated pages.
- The plan does not add live Alife calls.
