# Frontend Layout Optimization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate from hardcoded dark theme to CSS-variable-driven warm-light theme, integrate DESIGN.md design system, consolidate icons via better-icons, and add react-admin-inspired layout patterns — all while hardening security, accessibility, responsiveness, performance, and testability.

**Architecture:** Three-phase progressive enhancement: Phase 1 establishes security/a11y/theme/icons/design-system foundation (no user-visible layout changes). Phase 2 adds new layout components (FilterBar, Breadcrumb, ThemeToggle, mobile Drawer). Phase 3 deepens UX patterns (ListView/EditView, BulkActionBar, EmptyState, OptimisticFeedback, Dashboard widgets) and adds targeted tests.

**Tech Stack:** Next.js 16, React 19, Ant Design v6, Tailwind CSS v4, Zustand, SWR, Jest + RTL + Playwright, better-icons, DOMPurify

---

## File Structure

### New files to create:
```
DESIGN.md                                          # AI-readable design system (project root)
src/lib/sanitize.ts                                # DOMPurify input sanitization wrapper
src/lib/focus-manager.ts                           # Focus trap + focus restoration utilities
src/stores/themeStore.ts                           # Theme state (Zustand: light/dark/system)
src/components/providers/ThemeProvider.tsx          # Client theme engine wrapper
src/components/layout/BreadcrumbNav.tsx             # Auto breadcrumb navigation
src/components/layout/AppBarActions.tsx             # Page-level action buttons
src/components/layout/FilterBar.tsx                 # Filter + sort control bar
src/components/layout/BulkActionBar.tsx             # Bulk operation toolbar
src/components/ui/PageTitle.tsx                     # Page title + subtitle + actions
src/components/ui/ThemeToggle.tsx                   # Light/dark/system theme switcher
src/components/ui/EmptyState.tsx                    # Standardized empty state component
src/components/ui/OptimisticFeedback.tsx            # Optimistic update result feedback
src/components/ui/ListView.tsx                      # List page container pattern
src/components/ui/EditView.tsx                      # Edit page container pattern
src/components/ui/ShowView.tsx                      # Detail page container pattern
src/components/ui/SkipToMain.tsx                    # Skip-to-content accessibility link
src/components/dashboard/WidgetRegistry.ts          # Dashboard widget registration system
src/components/dashboard/WidgetContainer.tsx        # Dashboard widget container (drag + refresh)
src/components/icons/index.ts                       # better-icons unified export barrel
src/components/icons/package.json                   # better-icons project sync config
tests/unit/sanitize.test.ts                         # sanitize.ts unit tests
tests/unit/focus-manager.test.ts                    # focus-manager.ts unit tests
tests/unit/FilterBar.test.tsx                       # FilterBar component tests
tests/unit/ThemeToggle.test.tsx                     # ThemeToggle component tests
tests/unit/EmptyState.test.tsx                      # EmptyState component tests
tests/unit/BulkActionBar.test.tsx                   # BulkActionBar component tests
tests/unit/themeStore.test.ts                       # themeStore unit test
```

### Files to modify:
```
src/lib/design-system/tokens.ts                     # Add warmAmberTokens + update lightTokens
src/lib/api-client.ts                               # Add X-CSRF-Token to apiGet + apiDelete
src/components/providers/AntdProvider.tsx            # Switch to ThemeProvider + warm tokens
src/components/layout/AppLayout.tsx                 # Use CSS vars + SkipToMain + mobile Drawer
src/components/layout/Header.tsx                    # Use CSS vars + BreadcrumbNav + AppBarActions + ThemeToggle
src/components/layout/Sidebar.tsx                   # Use CSS vars + mobile Drawer mode + QuickActionGroup
src/components/layout/SearchModal.tsx               # Use CSS vars
src/components/layout/NotificationDropdown.tsx      # Use CSS vars
src/components/common/ErrorBoundary.tsx             # Use CSS vars
src/app/globals.css                                 # Update antd overrides to warm-light palette
src/app/(auth)/layout.tsx                           # Wrap with ThemeProvider
src/app/(auth)/dashboard/page.tsx                   # Integrate Dashboard widgets
src/app/(auth)/avatars/page.tsx                     # Integrate ListView + FilterBar
src/app/(auth)/marketplace/page.tsx                 # Integrate ListView + FilterBar
next.config.ts                                      # CSP hardening + Trusted Types
package.json                                        # Remove lucide-react, add dompurify + @types/dompurify
```

---

## Phase 1: Foundation — DESIGN.md + Icons + Security + Theme Migration (3 days)

### Task 1.1: Write DESIGN.md design system document

**Files:**
- Create: `DESIGN.md`

- [ ] **Step 1: Create the DESIGN.md at project root**

```markdown
# AstralFox Market — DESIGN.md

## Visual Theme & Atmosphere
Warm, clean, professional white-background design. Uses warm off-white (#faf7f2)
as the page background with pure white (#ffffff) cards. Warm amber (#d97706)
serves as the accent color for interactive elements. The overall aesthetic is
similar to Notion's minimal clarity with a warmer, more human tone — fitting
for a creative marketplace + AI desktop pet companion.

Design density: medium — enough whitespace to feel relaxed, compact enough
for data-heavy admin views. Borders are extremely subtle (rgba(0,0,0,0.06)).

## Color Palette & Roles
All colors MUST be accessed via CSS variables. NEVER hardcode hex/rgba in TSX.

| CSS Variable | Hex Value | Role |
|---|---|---|
| `--bg-deep` | `#faf7f2` | Page background |
| `--bg-card` | `#ffffff` | Card, sidebar, header, modal backgrounds |
| `--bg-card-hover` | `#f5f0e8` | Card/row hover state |
| `--accent` | `#d97706` | Primary buttons, selected states, links |
| `--accent-glow` | `rgba(217,119,6,0.15)` | Focus rings, button shadows |
| `--border-subtle` | `rgba(0,0,0,0.06)` | Card borders, dividers |
| `--border-default` | `rgba(0,0,0,0.10)` | Input borders, stronger separators |
| `--text-primary` | `#1c1917` | Headings, body text |
| `--text-secondary` | `#78716c` | Subtitle, descriptions, labels |
| `--text-muted` | `#a8a29e` | Placeholder, disabled, tertiary |
| `--danger` | `#dc2626` | Delete, error, destructive actions |
| `--success` | `#16a34a` | Success states, confirmations |
| `--warning` | `#d97706` | Warning states (same as accent) |
| `--info` | `#2563eb` | Info banners, help text |

## Typography Rules
- **Primary font:** Geist (variable: --font-geist), fallback: -apple-system, BlinkMacSystemFont, 'Noto Sans SC', sans-serif
- **Mono font:** Geist Mono (variable: --font-geist-mono), fallback: 'Fira Code', monospace
- **Scale:** xs(12px) / sm(14px) / base(16px) / lg(18px) / xl(20px) / 2xl(24px) / 3xl(30px)
- **Weights:** 400 normal / 500 medium / 600 semibold / 700 bold
- **Line heights:** 1.25 tight / 1.5 normal / 1.75 relaxed
- **Headings** use semibold(600), **body** uses normal(400).
- Antialiased rendering enabled globally.

## Component Stylings

### Buttons
- Primary: `background: var(--accent)`, white text, `box-shadow: 0 2px 8px var(--accent-glow)`
- Hover: `background: #f59e0b` (lighter amber)
- Default/secondary: `background: var(--bg-card)`, `border: 1px solid var(--border-subtle)`, `color: var(--text-primary)`
- Danger: `background: var(--danger)`, white text
- Radii: 6px (default), 8px (large)
- Height: 32px (small), 36px (default), 40px (large)

### Cards
- `background: var(--bg-card)`, `border: 1px solid var(--border-subtle)`
- `border-radius: 8px`, `box-shadow: var(--shadow-card)`
- Hover: `box-shadow: var(--shadow-card-hover)`
- Padding: 16px (compact), 24px (default)

### Inputs
- `background: var(--bg-card-hover)`, `border: 1px solid var(--border-subtle)`
- Focus: `border-color: var(--accent)`, `box-shadow: 0 0 0 3px var(--accent-glow)`
- Height: 32px (default), 40px (large)
- Radii: 6px

### Navigation (Sidebar)
- `background: var(--bg-card)`, `border-right: 1px solid var(--border-subtle)`
- Active item: `background: var(--bg-card-hover)`, `color: var(--accent)`
- Hover: `background: var(--bg-card-hover)`
- Collapsed width: 64px, Expanded width: 220px

### Tables
- Header: `background: var(--bg-card-hover)`, `color: var(--text-secondary)`
- Row: `border-bottom: 1px solid var(--border-subtle)`
- Row hover: `background: var(--bg-card-hover)`

## Layout Principles
- **Spacing scale:** 4px / 8px / 16px / 24px / 32px / 48px / 64px
- **Content padding:** 24px 32px (desktop), 16px (tablet), 12px (mobile)
- **Max content width:** 1440px (centered with `mx-auto`)
- **Grid:** Use CSS Grid for dashboard (repeat auto-fill), Flexbox for forms
- **Sidebar:** Fixed position, 220px width (collapsible to 64px)

## Depth & Elevation
| Level | Shadow | Usage |
|---|---|---|
| 0 (flat) | none | Page background |
| 1 (raised) | `0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)` | Cards |
| 2 (overlay) | `0 2px 8px rgba(0,0,0,0.06), 0 8px 32px rgba(0,0,0,0.06)` | Dropdowns, modals |
| 3 (modal) | `0 4px 16px rgba(0,0,0,0.08), 0 16px 48px rgba(0,0,0,0.08)` | Dialogs |

## Do's and Don'ts

### DO
- ✅ Use CSS variables for ALL colors: `style={{ color: 'var(--text-primary)' }}` or Tailwind classes mapping to vars
- ✅ Use Ant Design components as primary UI building blocks
- ✅ Use better-icons (Lucide) for custom icons, @ant-design/icons only inside antd component props
- ✅ All interactive elements MUST have visible focus rings (3px `var(--accent-glow)`)
- ✅ All images MUST have `alt` text
- ✅ Forms MUST have associated `<label>` elements

### DON'T
- ❌ NEVER hardcode `#` hex colors or `rgba()` in TSX/JSX — use CSS variables
- ❌ NEVER use `text-white`, `text-gray-*`, `bg-gray-*` Tailwind classes — use semantic classes
- ❌ NEVER remove focus outlines without adding a visible alternative
- ❌ NEVER use `<div>` for interactive elements — use `<button>`, `<a>`, or antd components
- ❌ NEVER skip heading levels (h1 → h3 without h2)

## Responsive Behavior
| Breakpoint | Width | Layout changes |
|---|---|---|
| Mobile | < 640px | Sidebar → fullscreen Drawer, tables → card stacks, Header → hamburger + title |
| Tablet | 640-1024px | Sidebar collapsed 64px, tables scrollable, FilterBar collapsible |
| Desktop | 1024-1440px | Sidebar 220px, full tables, KPI row, dual charts |
| Wide | > 1440px | Content max width constraint applied |

## Agent Prompt Guide
When asking an AI agent to build UI for this project, prepend:
"Follow the design system defined in DESIGN.md. Use CSS variables for all
colors (--bg-deep, --bg-card, --accent, --text-primary, --text-secondary,
--border-subtle). Use Ant Design components. Icons from better-icons
(Lucide collection). Warm white-background aesthetic with amber accents."
```

- [ ] **Step 2: Verify DESIGN.md is readable**

Run: `wc -l DESIGN.md`
Expected: ~150+ lines

- [ ] **Step 3: Commit**

```bash
git add DESIGN.md
git commit -m "docs: add DESIGN.md design system document for AI agents"
```

---

### Task 1.2: Set up better-icons + create icon directory

**Files:**
- Create: `src/components/icons/index.ts`
- Create: `src/components/icons/package.json`

- [ ] **Step 1: Initialize better-icons MCP server**

Run: `npx better-icons setup`
Expected: MCP config written, confirmation message

- [ ] **Step 2: Create the icon barrel export file**

Write `src/components/icons/index.ts`:

```typescript
/**
 * Unified icon barrel. Icons are written here by better-icons MCP server.
 * Source: Lucide collection (outline style, matching warm-light aesthetic).
 *
 * Usage: import { User, Search, Bell } from '@/components/icons';
 */

// Re-export Ant Design icons for antd component props (Menu, Button, etc.)
// These remain as @ant-design/icons — only antd internal usage.
// For custom components, use better-icons from this barrel.
export {};
```

- [ ] **Step 3: Create icon package.json for better-icons sync**

Write `src/components/icons/package.json`:

```json
{
  "name": "@astralfox/icons",
  "betterIcons": {
    "defaultCollection": "lucide",
    "framework": "react",
    "outputDir": ".",
    "barrelFile": "index.ts"
  }
}
```

- [ ] **Step 4: Verify setup**

Run: `npx better-icons search home --prefix lucide --limit 3`
Expected: Shows 3 matching icons from Lucide

- [ ] **Step 5: Commit**

```bash
git add src/components/icons/ .claude/mcp.json
git commit -m "feat: set up better-icons MCP server + icon directory"
```

---

### Task 1.3: Add warm amber light tokens to design system

**Files:**
- Modify: `src/lib/design-system/tokens.ts:89-191`

- [ ] **Step 1: Add warmAmberTokens and update lightTokens**

Replace the `lightTokens` definition and add `warmAmberTokens` after it:

```typescript
// ─── Warm Amber Light Theme (Primary) ────────────────────────
export const warmAmberTokens: DesignTokens = {
  colors: {
    bg: {
      deep: '#faf7f2',
      card: '#ffffff',
      cardHover: '#f5f0e8',
      elevated: '#ffffff',
    },
    accent: {
      primary: '#d97706',
      glow: 'rgba(217, 119, 6, 0.15)',
      hover: '#f59e0b',
    },
    border: {
      subtle: 'rgba(0, 0, 0, 0.06)',
      default: 'rgba(0, 0, 0, 0.10)',
    },
    text: {
      primary: '#1c1917',
      secondary: '#78716c',
      muted: '#a8a29e',
    },
    semantic: {
      danger: '#dc2626',
      success: '#16a34a',
      warning: '#d97706',
      info: '#2563eb',
    },
  },
  spacing: darkTokens.spacing,
  typography: darkTokens.typography,
  radii: darkTokens.radii,
};
```

- [ ] **Step 2: Update the barrel export**

Modify `src/lib/design-system/index.ts`, change the export line:

```typescript
export { darkTokens, lightTokens, warmAmberTokens, flattenTokens } from './tokens';
```

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/design-system/
git commit -m "feat: add warm amber light theme tokens (white bg + amber accent)"
```

---

### Task 1.4: Migrate AntdProvider to ThemeProvider with warm-light default

**Files:**
- Modify: `src/components/providers/AntdProvider.tsx`
- Create: `src/components/providers/ThemeProvider.tsx`
- Modify: `src/stores/uiStore.ts`

- [ ] **Step 1: Add theme state to uiStore**

Modify `src/stores/uiStore.ts`:

```typescript
'use client';

import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark' | 'system';

interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  isMobile: boolean;
  setIsMobile: (v: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  themeMode: 'light',
  setThemeMode: (mode) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme-mode', mode);
    }
    set({ themeMode: mode });
  },
  isMobile: false,
  setIsMobile: (v) => set({ isMobile: v }),
}));
```

- [ ] **Step 2: Create ThemeProvider**

Write `src/components/providers/ThemeProvider.tsx`:

```typescript
'use client';

import { useEffect } from 'react';
import { ConfigProvider, theme, App } from 'antd';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { useUIStore, type ThemeMode } from '@/stores/uiStore';
import { warmAmberTokens, darkTokens, toAntdThemeTokens } from '@/lib/design-system';

function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  }
  return mode === 'dark' ? 'dark' : 'light';
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const themeMode = useUIStore((s) => s.themeMode);
  const resolved = resolveTheme(themeMode);
  const tokens = resolved === 'dark' ? darkTokens : warmAmberTokens;

  // Hydrate theme from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('theme-mode') as ThemeMode | null;
    if (stored && stored !== themeMode) {
      useUIStore.setState({ themeMode: stored });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // SSR-safe: set data-theme attribute on <html> for Tailwind
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolved);
  }, [resolved]);

  return (
    <AntdRegistry>
      <ConfigProvider
        theme={{
          algorithm: resolved === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
          token: toAntdThemeTokens(tokens),
        }}
      >
        <App>
          {children}
        </App>
      </ConfigProvider>
    </AntdRegistry>
  );
}
```

- [ ] **Step 3: Replace AntdProvider with ThemeProvider in root layout**

Modify `src/app/layout.tsx`:
- Change `import AntdProvider from '@/components/providers/AntdProvider';` to `import ThemeProvider from '@/components/providers/ThemeProvider';`
- Change `<AntdProvider>` to `<ThemeProvider>`

- [ ] **Step 4: Remove old AntdProvider**

Delete `src/components/providers/AntdProvider.tsx`

- [ ] **Step 5: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git rm src/components/providers/AntdProvider.tsx
git add src/components/providers/ThemeProvider.tsx src/stores/uiStore.ts src/app/layout.tsx
git commit -m "feat: replace AntdProvider with ThemeProvider (warm-light default)"
```

---

### Task 1.5: Migrate 6 components from hardcoded dark colors to CSS variables

**Files:**
- Modify: `src/components/layout/AppLayout.tsx`
- Modify: `src/components/layout/Header.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/layout/SearchModal.tsx`
- Modify: `src/components/layout/NotificationDropdown.tsx`
- Modify: `src/components/common/ErrorBoundary.tsx`

- [ ] **Step 1: Migrate AppLayout.tsx**

Replace the `Spin` wrapper div and `Layout` style:

```typescript
// Loading state — replace style={{ background: '#09090F' }} with CSS var
<div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-deep)' }}>
  <Spin size="large" />
</div>

// Main Layout — remove hardcoded background, marginLeft, and transparent bg
<Layout style={{ minHeight: '100vh' }}>
  <a href="#main-content" className="sr-only ..."  /* keep skip link as-is */>
    {t('skipToMain')}
  </a>
  <Sidebar />
  <Layout style={{
    marginLeft: sidebarCollapsed ? 64 : 220,
    background: 'var(--bg-deep)',
    transition: 'margin-left 0.2s',
  }}>
    <Header />
    <Content id="main-content" role="main" style={{
      padding: '24px 32px',
      minHeight: 'calc(100vh - 64px)',
    }}>
      {children}
    </Content>
  </Layout>
</Layout>
```

- [ ] **Step 2: Migrate Header.tsx**

Replace the hardcoded background div:

```typescript
// Replace: background: 'rgba(9, 9, 15, 0.8)', backdropFilter: 'blur(12px)'
<div
  className="flex items-center justify-between h-16 px-6"
  style={{
    background: 'var(--bg-card)',
    borderBottom: '1px solid var(--border-subtle)',
  }}
>
```

Replace text color classes:
- `text-gray-500` → style `{ color: 'var(--text-secondary)' }`
- `text-gray-300` → style `{ color: 'var(--text-primary)' }`
- `text-gray-400` → style `{ color: 'var(--text-secondary)' }`
- `className="bg-[#12122A] border-purple-500/10 hover:border-purple-500/30"` → style `{ background: 'var(--bg-card-hover)', borderColor: 'var(--border-subtle)' }`

- [ ] **Step 3: Migrate Sidebar.tsx**

Replace Sider `style` prop:

```typescript
style={{
  background: 'var(--bg-card)',
  borderRight: '1px solid var(--border-subtle)',
  height: '100vh',
  position: 'fixed',
  left: 0,
  top: 0,
  zIndex: 100,
}}
```

Replace the logo container border:
- `border-b border-purple-500/10` → `borderBottom: '1px solid var(--border-subtle)'`

Replace the CTA button class:
- `className="bg-gradient-to-r from-purple-600 to-blue-600 border-0 h-9 font-medium"` →
- `style={{ background: 'linear-gradient(90deg, var(--accent), var(--info))', border: 'none', height: 36, fontWeight: 500 }}`

Replace collapse toggle color:
- `style={{ color: '#5e5e7a' }}` → `style={{ color: 'var(--text-muted)' }}`

- [ ] **Step 4: Migrate SearchModal.tsx**

Replace hardcoded `#12122A`:

```typescript
styles={{ body: { padding: 0, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' } }}
```

Replace all `text-white` → `style={{ color: 'var(--text-primary)' }}`
Replace `text-gray-500` → `style={{ color: 'var(--text-muted)' }}`
Replace `hover:bg-purple-500/10` → `style={{ background: 'var(--bg-card-hover)' }}` on hover

Replace the `!text-white` on Input:
```typescript
className="px-4 py-3"
style={{ color: 'var(--text-primary)' }}
```

Replace the border separator:
- `border-t border-purple-500/10` → `borderTop: '1px solid var(--border-subtle)'`

- [ ] **Step 5: Migrate NotificationDropdown.tsx**

Replace the dropdown wrapper div style:

```typescript
style={{
  background: 'var(--bg-card)',
  border: '1px solid var(--border-subtle)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
}}
```

Replace all `text-white` → `style={{ color: 'var(--text-primary)' }}`
Replace all `text-gray-500/600` → `style={{ color: 'var(--text-muted)' }}`
Replace `border-purple-500/10` → `style={{ borderColor: 'var(--border-subtle)' }}`
Replace `bg-purple-500/5` → `style={{ background: 'var(--bg-card-hover)' }}`

- [ ] **Step 6: Migrate ErrorBoundary.tsx**

Replace hardcoded `#09090F`:

```typescript
<div className="min-h-[60vh] flex items-center justify-center" style={{ background: 'var(--bg-deep)' }}>
  <div className="text-center max-w-md px-6">
    <div className="text-5xl mb-4">⚠</div>
    <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
      {t('pageLoadError')}
    </h2>
    <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
      {this.state.error?.message || t('unknownError')}
    </p>
    <Button type="primary" icon={<ReloadOutlined />} onClick={...}>
      {t('refreshPage')}
    </Button>
  </div>
</div>
```

- [ ] **Step 7: Run typecheck and verify**

Run: `npx tsc --noEmit`
Expected: No errors

Run: `npm run dev` and visually inspect http://localhost:3000/login
Expected: White background, warm amber accents, readable dark text

- [ ] **Step 8: Commit**

```bash
git add src/components/
git commit -m "refactor: migrate 6 components from hardcoded dark colors to CSS variables"
```

---

### Task 1.6: Add DOMPurify input sanitization layer

**Files:**
- Create: `src/lib/sanitize.ts`
- Modify: `package.json` (add dompurify, @types/dompurify)

- [ ] **Step 1: Install DOMPurify**

Run: `npm install dompurify && npm install -D @types/dompurify`

- [ ] **Step 2: Create sanitize.ts**

Write `src/lib/sanitize.ts`:

```typescript
import DOMPurify from 'dompurify';

// Allow only safe tags and attributes for user-generated content
const ALLOWED_TAGS = ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'code', 'pre'];
const ALLOWED_ATTR = ['href', 'target', 'rel'];

/**
 * Sanitize HTML string from user input. Strips all XSS vectors.
 * Use for: comments, messages, profile bios, marketplace descriptions.
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty) return '';
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ['target'], // Allow target="_blank" on links
  });
}

/**
 * Sanitize plain text string. Strips ALL HTML tags.
 * Use for: search queries, usernames, filenames, any non-rich-text input.
 */
export function sanitizeText(dirty: string): string {
  if (!dirty) return '';
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

/**
 * Strips HTML tags entirely, returning plain text only.
 * Use for: extracting plain text from user rich text for indexing/truncation.
 */
export function stripHtml(html: string): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
}
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/sanitize.ts package.json package-lock.json
git commit -m "feat: add DOMPurify input sanitization layer (sanitizeHtml/sanitizeText/stripHtml)"
```

---

### Task 1.7: Harden CSP with Trusted Types

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Add Trusted Types policy to CSP**

Modify `next.config.ts`, add to the CSP value array after `"base-uri 'self'"`:

```typescript
// Add Trusted Types requirement
"require-trusted-types-for 'script'",
// Trusted Types policy name
"trusted-types antd-emotion default",
```

- [ ] **Step 2: Verify CSP header**

Run: `npm run build && npm run start`
Then: `curl -I http://localhost:3000 | grep -i content-security-policy`
Expected: Contains `require-trusted-types-for 'script'` and `trusted-types antd-emotion default`

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "security: add Trusted Types to CSP for XSS hardening"
```

---

### Task 1.8: Add X-CSRF-Token to all API client methods

**Files:**
- Modify: `src/lib/api-client.ts`

- [ ] **Step 1: Add CSRF header to apiGet and apiDelete**

In `src/lib/api-client.ts`, add `csrfHeaders()` to `apiGet`:

```typescript
// In apiGet, change headers line:
headers: csrfHeaders({ Authorization: `Bearer ${token}` }),
```

In `apiDelete`, change:

```typescript
headers: csrfHeaders({ Authorization: `Bearer ${token}` }),
```

- [ ] **Step 2: Verify existing POST/PUT already use csrfHeaders**

Read `apiPost`, `apiPut`, `apiPostFormData` — confirm they already call `csrfHeaders()`.
Expected: They already do. No changes needed.

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/api-client.ts
git commit -m "security: add X-CSRF-Token to apiGet and apiDelete for full CSRF coverage"
```

---

### Task 1.9: Update globals.css antd overrides to warm-light palette

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Replace antd override colors**

Replace the antd-specific CSS overrides in `globals.css` (lines 76-119) with warm-light variables:

```css
.ant-btn-primary {
  background: var(--accent);
  box-shadow: var(--shadow-button);
}
.ant-btn-primary:hover { background: #f59e0b; }

.ant-input {
  background: var(--bg-card-hover) !important;
  border-color: var(--border-subtle) !important;
  color: var(--text-primary) !important;
}
.ant-input:hover { border-color: var(--border-default) !important; }
.ant-input:focus, .ant-input-focused {
  border-color: var(--accent) !important;
  box-shadow: 0 0 0 3px var(--accent-glow) !important;
}

.ant-card {
  background: var(--bg-card) !important;
  border-color: var(--border-subtle) !important;
}

.ant-table { background: transparent !important; color: var(--text-primary) !important; }
.ant-table-thead > tr > th {
  background: var(--bg-card-hover) !important;
  color: var(--text-secondary) !important;
  border-color: var(--border-subtle) !important;
}
.ant-table-tbody > tr > td {
  border-color: var(--border-subtle) !important;
  color: var(--text-primary) !important;
}
.ant-table-tbody > tr:hover > td { background: var(--bg-card-hover) !important; }

.ant-select-dropdown, .ant-dropdown-menu, .ant-picker-dropdown .ant-picker-panel-container {
  background: var(--bg-card) !important;
  border-color: var(--border-subtle) !important;
}

.ant-message .ant-message-notice-content {
  background: var(--bg-card) !important;
  color: var(--text-primary) !important;
}

.ant-divider { border-color: var(--border-subtle) !important; }
.ant-tabs-tab { color: var(--text-secondary) !important; }
.ant-tabs-tab-active .ant-tabs-tab-btn { color: var(--accent) !important; }
.ant-tabs-ink-bar { background: var(--accent) !important; }
.ant-slider-rail { background: var(--border-subtle) !important; }
.ant-slider-track { background: var(--accent) !important; }
.ant-slider-handle {
  border-color: var(--accent) !important;
  box-shadow: var(--shadow-button) !important;
}

.ant-layout-sider {
  background: var(--bg-card) !important;
  border-right: 1px solid var(--border-subtle) !important;
}

.ant-menu { background: transparent !important; border-inline-end: none !important; }
.ant-menu-item { color: var(--text-secondary) !important; }
.ant-menu-item:hover { background: var(--bg-card-hover) !important; color: var(--text-primary) !important; }
.ant-menu-item-selected {
  background: var(--bg-card-hover) !important;
  color: var(--accent) !important;
}

.ant-layout-header {
  background: var(--bg-card) !important;
  border-bottom: 1px solid var(--border-subtle) !important;
}
```

Also update the `:root` CSS variables to use warm amber as defaults:

```css
:root {
  --bg-deep: #faf7f2;
  --bg-card: #ffffff;
  --bg-card-hover: #f5f0e8;
  --accent: #d97706;
  --accent-glow: rgba(217, 119, 6, 0.15);
  --border-subtle: rgba(0, 0, 0, 0.06);
  --border-default: rgba(0, 0, 0, 0.10);
  --text-primary: #1c1917;
  --text-secondary: #78716c;
  --text-muted: #a8a29e;
  --danger: #dc2626;
  --success: #16a34a;
  --warning: #d97706;
  --info: #2563eb;
  --shadow-card: 0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04);
  --shadow-card-hover: 0 2px 8px rgba(0,0,0,0.06), 0 8px 32px rgba(0,0,0,0.06);
  --shadow-button: 0 2px 8px var(--accent-glow);
}
```

- [ ] **Step 2: Run dev server and verify visually**

Run: `npm run dev`
Open http://localhost:3000
Expected: Warm white background, amber buttons, clean card borders, readable text throughout

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "style: update globals.css antd overrides + CSS variables to warm-amber light palette"
```

---

### Task 1.10: Remove lucide-react dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Remove lucide-react**

Run: `npm uninstall lucide-react`
Expected: Package removed (was not used in any source file)

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: No errors, no missing import errors

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove unused lucide-react dependency (replaced by better-icons)"
```

---

### Task 1.11: Add hardcoded-color CI check

**Files:**
- Create: `.github/workflows/scripts/check-hardcoded-colors.sh`

- [ ] **Step 1: Create the check script**

Write `.github/workflows/scripts/check-hardcoded-colors.sh`:

```bash
#!/bin/bash
# Check that TSX files do not contain hardcoded hex/rgba colors.
# Colors must use CSS variables (var(--xxx)).
set -euo pipefail

# Match #xxx or #xxxxxx hex colors in style={{}} or className, but NOT in comments
# and NOT in CSS variable definitions or DESIGN.md
VIOLATIONS=$(grep -rn \
  --include='*.tsx' \
  --exclude-dir=node_modules \
  --exclude-dir=.next \
  -E "(style=\{\{.*['\"]#[0-9a-fA-F]{3,8}|className=.*['\"]#[0-9a-fA-F]{3,8})" \
  src/ || true)

if [ -n "$VIOLATIONS" ]; then
  echo "ERROR: Hardcoded colors found in TSX files:"
  echo "$VIOLATIONS"
  echo ""
  echo "Use CSS variables instead: var(--bg-deep), var(--bg-card), var(--accent), etc."
  echo "See DESIGN.md for the full color palette."
  exit 1
fi

echo "✓ No hardcoded colors found in TSX files."
```

- [ ] **Step 2: Make script executable**

Run: `chmod +x .github/workflows/scripts/check-hardcoded-colors.sh`

- [ ] **Step 3: Add to CI workflow (if it exists)**

Run: `ls .github/workflows/ci.yml`
If it exists, add a step:

```yaml
- name: Check for hardcoded colors
  run: bash .github/workflows/scripts/check-hardcoded-colors.sh
```

- [ ] **Step 4: Run check locally**

Run: `bash .github/workflows/scripts/check-hardcoded-colors.sh`
Expected: `✓ No hardcoded colors found in TSX files.`

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/scripts/check-hardcoded-colors.sh
git commit -m "ci: add hardcoded-color check to prevent hex/rgba in TSX"
```

---

## Phase 2: Layout Enhancement + Performance (3 days)

### Task 2.1: Create SkipToMain accessibility component

**Files:**
- Create: `src/components/ui/SkipToMain.tsx`

- [ ] **Step 1: Write the component**

Write `src/components/ui/SkipToMain.tsx`:

```typescript
'use client';

import { useTranslations } from 'next-intl';

export default function SkipToMain() {
  const t = useTranslations('a11y');

  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[9999] focus:px-4 focus:py-2 focus:rounded-md focus:no-underline focus:font-medium"
      style={{
        background: 'var(--accent)',
        color: '#ffffff',
      }}
    >
      {t('skipToMain')}
    </a>
  );
}
```

- [ ] **Step 2: Integrate into AppLayout**

Modify `src/components/layout/AppLayout.tsx`:
- Add `import SkipToMain from '@/components/ui/SkipToMain';`
- Replace the inline `<a href="#main-content" ...>` with `<SkipToMain />`

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/SkipToMain.tsx src/components/layout/AppLayout.tsx
git commit -m "feat: add SkipToMain accessibility component with focus management"
```

---

### Task 2.2: Create focus-manager utility

**Files:**
- Create: `src/lib/focus-manager.ts`

- [ ] **Step 1: Write focus-manager.ts**

Write `src/lib/focus-manager.ts`:

```typescript
/**
 * Focus management utilities for modals, drawers, and dialogs.
 * Implements focus trapping and restoration following WCAG 2.1.
 */

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Trap focus within a container element. Tab/Shift+Tab cycle within the container.
 * Returns a cleanup function.
 */
export function trapFocus(container: HTMLElement): () => void {
  const previousFocus = document.activeElement as HTMLElement | null;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  container.addEventListener('keydown', handleKeyDown);

  // Focus first focusable element
  const firstFocusable = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
  firstFocusable?.focus();

  return () => {
    container.removeEventListener('keydown', handleKeyDown);
    previousFocus?.focus();
  };
}

/**
 * Restore focus to a previously focused element.
 */
export function restoreFocus(element: HTMLElement | null): void {
  element?.focus();
}

/**
 * Get all focusable elements within a container.
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/focus-manager.ts
git commit -m "feat: add focus-manager utility (trapFocus, restoreFocus)"
```

---

### Task 2.3: Create ThemeToggle component

**Files:**
- Create: `src/components/ui/ThemeToggle.tsx`

- [ ] **Step 1: Write ThemeToggle**

Write `src/components/ui/ThemeToggle.tsx`:

```typescript
'use client';

import { Button, Tooltip } from 'antd';
import { SunOutlined, MoonOutlined, LaptopOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { useUIStore, type ThemeMode } from '@/stores/uiStore';

const modes: { mode: ThemeMode; icon: typeof SunOutlined; label: string }[] = [
  { mode: 'light', icon: SunOutlined, label: 'light' },
  { mode: 'dark', icon: MoonOutlined, label: 'dark' },
  { mode: 'system', icon: LaptopOutlined, label: 'system' },
];

export default function ThemeToggle() {
  const t = useTranslations('theme');
  const themeMode = useUIStore((s) => s.themeMode);
  const setThemeMode = useUIStore((s) => s.setThemeMode);

  const cycleTheme = () => {
    const idx = modes.findIndex((m) => m.mode === themeMode);
    const next = modes[(idx + 1) % modes.length];
    setThemeMode(next.mode);
  };

  const current = modes.find((m) => m.mode === themeMode)!;
  const Icon = current.icon;

  return (
    <Tooltip title={t(current.label)}>
      <Button
        type="text"
        icon={<Icon size={18} />}
        onClick={cycleTheme}
        aria-label={t('switchTo', { mode: t(current.label) })}
        style={{ color: 'var(--text-secondary)' }}
      />
    </Tooltip>
  );
}
```

> **Note:** Uses @ant-design/icons (SunOutlined, MoonOutlined, LaptopOutlined) which are already available.

- [ ] **Step 2: Add ThemeToggle to Header**

Modify `src/components/layout/Header.tsx`:
- Add `import ThemeToggle from '@/components/ui/ThemeToggle';`
- Add `<ThemeToggle />` between `<NotificationDropdown />` and the user `Dropdown`

- [ ] **Step 3: Add theme i18n keys**

Add to `messages/en.json`:

```json
"theme": {
  "light": "Light",
  "dark": "Dark",
  "system": "System",
  "switchTo": "Switch to {mode} theme"
}
```

Add to `messages/zh-CN.json`:

```json
"theme": {
  "light": "浅色",
  "dark": "深色",
  "system": "跟随系统",
  "switchTo": "切换到{mode}模式"
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/ThemeToggle.tsx src/components/layout/Header.tsx messages/
git commit -m "feat: add ThemeToggle (light/dark/system) to Header"
```

---

### Task 2.4: Add mobile Sidebar Drawer mode

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/layout/AppLayout.tsx`
- Modify: `src/stores/uiStore.ts`

- [ ] **Step 1: Add mobile Drawer to Sidebar**

Modify `Sidebar.tsx` — wrap Sider in conditional logic:

```typescript
'use client';

import { useEffect, useRef } from 'react';
import { Layout, Menu, Button, Drawer } from 'antd';
// ... (existing imports)
import { useUIStore } from '@/stores/uiStore';

export default function Sidebar() {
  const t = useTranslations('layout.sidebar');
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const isMobile = useUIStore((s) => s.isMobile);
  const mobileMenuOpen = useUIStore((s) => s.mobileMenuOpen);
  const setMobileMenuOpen = useUIStore((s) => s.setMobileMenuOpen);
  // ... existing router, pathname, user, menuItems, filteredItems logic

  const sidebarContent = (
    <>
      {/* ... existing logo + brand + menu content */}
      {/* The entire existing Sider body goes here */}
    </>
  );

  // Mobile: show Drawer
  if (isMobile) {
    return (
      <Drawer
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        placement="left"
        width={280}
        styles={{ body: { padding: 0, background: 'var(--bg-card)' }, header: { display: 'none' } }}
      >
        {sidebarContent}
      </Drawer>
    );
  }

  // Desktop: show fixed Sider
  return (
    <nav aria-label={t('mainNav')}>
      <div ref={sidebarRef}>
        <Sider
          trigger={null}
          collapsible
          collapsed={collapsed}
          width={220}
          collapsedWidth={64}
          style={{
            background: 'var(--bg-card)',
            borderRight: '1px solid var(--border-subtle)',
            height: '100vh',
            position: 'fixed',
            left: 0,
            top: 0,
            zIndex: 100,
          }}
        >
          {sidebarContent}
        </Sider>
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Update uiStore for mobile menu**

Modify `src/stores/uiStore.ts`, add to `UIState`:

```typescript
mobileMenuOpen: boolean;
setMobileMenuOpen: (v: boolean) => void;
```

Add to `create`:

```typescript
mobileMenuOpen: false,
setMobileMenuOpen: (v) => set({ mobileMenuOpen: v }),
```

- [ ] **Step 3: Add hamburger menu button to Header (mobile only)**

Modify `src/components/layout/Header.tsx`, add before the search bar:

```typescript
import { MenuOutlined } from '@ant-design/icons';
// ...
const isMobile = useUIStore((s) => s.isMobile);
const setMobileMenuOpen = useUIStore((s) => s.setMobileMenuOpen);

// In the header div, before the search input:
{isMobile && (
  <Button
    type="text"
    icon={<MenuOutlined />}
    onClick={() => setMobileMenuOpen(true)}
    aria-label={tHeader('menu')}
    style={{ color: 'var(--text-primary)' }}
  />
)}
```

- [ ] **Step 4: Add mobile detection to AppLayout**

Modify `src/components/layout/AppLayout.tsx`, add a useEffect:

```typescript
const setIsMobile = useUIStore((s) => s.setIsMobile);

useEffect(() => {
  const check = () => setIsMobile(window.innerWidth < 640);
  check();
  window.addEventListener('resize', check);
  return () => window.removeEventListener('resize', check);
}, [setIsMobile]);
```

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Sidebar.tsx src/components/layout/AppLayout.tsx src/components/layout/Header.tsx src/stores/uiStore.ts
git commit -m "feat: add mobile Sidebar Drawer mode with hamburger menu"
```

---

### Task 2.5: Create BreadcrumbNav + AppBarActions

**Files:**
- Create: `src/components/layout/BreadcrumbNav.tsx`
- Create: `src/components/layout/AppBarActions.tsx`
- Modify: `src/components/layout/Header.tsx`

- [ ] **Step 1: Write BreadcrumbNav**

Write `src/components/layout/BreadcrumbNav.tsx`:

```typescript
'use client';

import { Breadcrumb } from 'antd';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

const LABEL_MAP: Record<string, string> = {
  dashboard: 'layout.sidebar.dashboard',
  pet: 'layout.sidebar.pet',
  avatars: 'layout.sidebar.avatars',
  assets: 'layout.sidebar.assets',
  marketplace: 'layout.sidebar.marketplace',
  community: 'layout.sidebar.community',
  purchases: 'layout.sidebar.myPurchases',
  messages: 'layout.sidebar.messages',
  seller: 'layout.sidebar.sellerCenter',
  settings: 'layout.sidebar.settings',
  admin: 'layout.sidebar.admin',
  help: 'layout.sidebar.help',
  notifications: 'layout.sidebar.notifications',
};

export default function BreadcrumbNav() {
  const pathname = usePathname();
  const t = useTranslations();

  const segments = pathname.split('/').filter(Boolean);
  const items = segments.map((seg, i) => {
    const href = '/' + segments.slice(0, i + 1).join('/');
    const labelKey = LABEL_MAP[seg];
    return {
      title: labelKey ? t(labelKey) : seg.charAt(0).toUpperCase() + seg.slice(1),
      href: i < segments.length - 1 ? href : undefined,
    };
  });

  if (items.length <= 1) return null;

  return (
    <Breadcrumb
      items={items}
      style={{ fontSize: '0.8125rem' }}
    />
  );
}
```

- [ ] **Step 2: Write AppBarActions**

Write `src/components/layout/AppBarActions.tsx`:

```typescript
'use client';

import { Button, Space } from 'antd';
import { PlusOutlined, ReloadOutlined, ExportOutlined } from '@ant-design/icons';

export interface AppBarAction {
  key: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  type?: 'primary' | 'default';
}

interface Props {
  actions: AppBarAction[];
}

export default function AppBarActions({ actions }: Props) {
  if (actions.length === 0) return null;

  return (
    <Space size="small">
      {actions.map((action) => (
        <Button
          key={action.key}
          type={action.type === 'primary' ? 'primary' : 'default'}
          icon={action.icon}
          onClick={action.onClick}
          size="small"
        >
          {action.label}
        </Button>
      ))}
    </Space>
  );
}
```

- [ ] **Step 3: Integrate into Header**

Modify `src/components/layout/Header.tsx`:
- Add imports for `BreadcrumbNav` and `AppBarActions`
- Add `<BreadcrumbNav />` as the first element in the header flex container (desktop only, hidden on mobile)
- Add `<AppBarActions actions={[]} />` placeholder — pages will inject actions via a prop or context

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/BreadcrumbNav.tsx src/components/layout/AppBarActions.tsx src/components/layout/Header.tsx
git commit -m "feat: add BreadcrumbNav + AppBarActions components"
```

---

### Task 2.6: Create FilterBar component

**Files:**
- Create: `src/components/layout/FilterBar.tsx`

- [ ] **Step 1: Write FilterBar**

Write `src/components/layout/FilterBar.tsx`:

```typescript
'use client';

import { Input, Select, Space, Button } from 'antd';
import { SearchOutlined, FilterOutlined, SortAscendingOutlined } from '@ant-design/icons';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useCallback } from 'react';

export interface FilterField {
  key: string;
  label: string;
  type: 'search' | 'select';
  options?: { value: string; label: string }[];
  placeholder?: string;
}

export interface SortOption {
  value: string;
  label: string;
}

interface Props {
  filters: FilterField[];
  sortOptions?: SortOption[];
  defaultSort?: string;
}

export default function FilterBar({ filters, sortOptions, defaultSort }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [searchParams, router, pathname],
  );

  const clearAll = () => {
    router.push(pathname);
  };

  const hasFilters = Array.from(searchParams.keys()).some((k) => k !== 'page');

  return (
    <div
      className="flex flex-wrap items-center gap-3 p-3 rounded-lg mb-4"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <FilterOutlined style={{ color: 'var(--text-muted)' }} />
      <Space wrap size="small">
        {filters.map((field) => {
          if (field.type === 'search') {
            return (
              <Input
                key={field.key}
                prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
                placeholder={field.placeholder || field.label}
                value={searchParams.get(field.key) || ''}
                onChange={(e) => updateParam(field.key, e.target.value)}
                allowClear
                style={{ width: 200 }}
              />
            );
          }
          return (
            <Select
              key={field.key}
              placeholder={field.label}
              value={searchParams.get(field.key) || undefined}
              onChange={(v) => updateParam(field.key, v || '')}
              allowClear
              options={field.options}
              style={{ minWidth: 120 }}
            />
          );
        })}
        {sortOptions && (
          <Select
            prefix={<SortAscendingOutlined style={{ color: 'var(--text-muted)' }} />}
            placeholder="Sort by"
            value={searchParams.get('sort') || defaultSort || undefined}
            onChange={(v) => updateParam('sort', v || '')}
            options={sortOptions}
            style={{ minWidth: 140 }}
          />
        )}
        {hasFilters && (
          <Button type="link" size="small" onClick={clearAll}>
            Clear all
          </Button>
        )}
      </Space>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/FilterBar.tsx
git commit -m "feat: add FilterBar component with URL-synced filters + sort"
```

---

### Task 2.7: Responsive breakpoint system + component adaptations

**Files:**
- Modify: `src/components/layout/AppLayout.tsx` (responsive padding)
- Modify: `src/app/(auth)/marketplace/page.tsx` (responsive search/cards)
- Modify: `src/app/(auth)/dashboard/page.tsx` (responsive KPI grid)

- [ ] **Step 1: Add responsive content padding to AppLayout**

Modify `src/components/layout/AppLayout.tsx` Content style:

```typescript
<Content id="main-content" role="main" className="p-3 md:p-6 lg:px-8" style={{ minHeight: 'calc(100vh - 64px)' }}>
  {children}
</Content>
```

- [ ] **Step 2: Adapt dashboard KPI grid for mobile**

Modify `src/app/(auth)/dashboard/page.tsx` — find the KPI cards grid div:

```typescript
// Change: grid grid-cols-1 lg:grid-cols-2 gap-4 → responsive
<div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
  <KpiCards ... />
</div>
```

- [ ] **Step 3: Adapt charts grid for mobile**

```typescript
// Change: grid-cols-1 lg:grid-cols-2 → stays the same (already responsive)
```

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/AppLayout.tsx src/app/\(auth\)/dashboard/page.tsx
git commit -m "refactor: add responsive breakpoints to AppLayout and dashboard"
```

---

## Phase 3: UX Patterns + Testing (2 days)

### Task 3.1: Create PageTitle component

**Files:**
- Create: `src/components/ui/PageTitle.tsx`

- [ ] **Step 1: Write PageTitle**

Write `src/components/ui/PageTitle.tsx`:

```typescript
import type { ReactNode } from 'react';

interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export default function PageTitle({ title, subtitle, actions }: Props) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/PageTitle.tsx
git commit -m "feat: add PageTitle component (title + subtitle + actions)"
```

---

### Task 3.2: Create EmptyState component

**Files:**
- Create: `src/components/ui/EmptyState.tsx`

- [ ] **Step 1: Write EmptyState**

Write `src/components/ui/EmptyState.tsx`:

```typescript
import { Empty, Button } from 'antd';
import type { ReactNode } from 'react';

interface Props {
  description?: string;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  variant?: 'default' | 'compact';
}

export default function EmptyState({
  description = 'No data available',
  icon,
  actionLabel,
  onAction,
  variant = 'default',
}: Props) {
  return (
    <div
      className={`flex items-center justify-center ${variant === 'compact' ? 'py-8' : 'py-16'}`}
      style={{ color: 'var(--text-muted)' }}
    >
      <Empty
        image={icon || Empty.PRESENTED_IMAGE_SIMPLE}
        description={<span style={{ color: 'var(--text-secondary)' }}>{description}</span>}
      >
        {actionLabel && onAction && (
          <Button type="primary" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </Empty>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/EmptyState.tsx
git commit -m "feat: add EmptyState component (default + compact variants)"
```

---

### Task 3.3: Create ListView, EditView, ShowView page patterns

**Files:**
- Create: `src/components/ui/ListView.tsx`
- Create: `src/components/ui/EditView.tsx`
- Create: `src/components/ui/ShowView.tsx`

- [ ] **Step 1: Write ListView**

Write `src/components/ui/ListView.tsx`:

```typescript
import type { ReactNode } from 'react';
import PageTitle from './PageTitle';
import EmptyState from './EmptyState';

interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  filters?: ReactNode;          // FilterBar instance
  bulkActions?: ReactNode;      // BulkActionBar instance
  empty?: boolean;
  emptyDescription?: string;
  onCreateAction?: () => void;
  createLabel?: string;
  children: ReactNode;
}

export default function ListView({
  title,
  subtitle,
  actions,
  filters,
  bulkActions,
  empty,
  emptyDescription,
  onCreateAction,
  createLabel,
  children,
}: Props) {
  return (
    <div>
      <PageTitle title={title} subtitle={subtitle} actions={actions} />
      {filters}
      {bulkActions}
      {empty ? (
        <EmptyState
          description={emptyDescription || `No ${title.toLowerCase()} found`}
          actionLabel={createLabel}
          onAction={onCreateAction}
        />
      ) : (
        children
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write EditView**

Write `src/components/ui/EditView.tsx`:

```typescript
import type { ReactNode } from 'react';
import { Button, Space } from 'antd';
import PageTitle from './PageTitle';

interface Props {
  title: string;
  subtitle?: string;
  onSave: () => void;
  onCancel: () => void;
  saveLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  children: ReactNode;
}

export default function EditView({
  title,
  subtitle,
  onSave,
  onCancel,
  saveLabel = 'Save',
  cancelLabel = 'Cancel',
  loading,
  children,
}: Props) {
  return (
    <div className="max-w-3xl mx-auto">
      <PageTitle
        title={title}
        subtitle={subtitle}
        actions={
          <Space>
            <Button onClick={onCancel}>{cancelLabel}</Button>
            <Button type="primary" onClick={onSave} loading={loading}>
              {saveLabel}
            </Button>
          </Space>
        }
      />
      <div
        className="p-6 rounded-lg"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
      >
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write ShowView**

Write `src/components/ui/ShowView.tsx`:

```typescript
import type { ReactNode } from 'react';
import { Button, Space } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import PageTitle from './PageTitle';

interface Props {
  title: string;
  subtitle?: string;
  onEdit?: () => void;
  extraActions?: ReactNode;
  children: ReactNode;
}

export default function ShowView({ title, subtitle, onEdit, extraActions, children }: Props) {
  return (
    <div className="max-w-3xl mx-auto">
      <PageTitle
        title={title}
        subtitle={subtitle}
        actions={
          <Space>
            {extraActions}
            {onEdit && (
              <Button type="primary" icon={<EditOutlined />} onClick={onEdit}>
                Edit
              </Button>
            )}
          </Space>
        }
      />
      <div
        className="p-6 rounded-lg"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
      >
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/ListView.tsx src/components/ui/EditView.tsx src/components/ui/ShowView.tsx
git commit -m "feat: add ListView/EditView/ShowView page pattern components"
```

---

### Task 3.4: Create BulkActionBar + OptimisticFeedback

**Files:**
- Create: `src/components/layout/BulkActionBar.tsx`
- Create: `src/components/ui/OptimisticFeedback.tsx`

- [ ] **Step 1: Write BulkActionBar**

Write `src/components/layout/BulkActionBar.tsx`:

```typescript
'use client';

import { Button, Space, Typography } from 'antd';
import { CloseOutlined } from '@ant-design/icons';

interface BulkAction {
  key: string;
  label: string;
  onClick: (selectedIds: string[]) => void;
  danger?: boolean;
}

interface Props {
  selectedCount: number;
  selectedIds: string[];
  actions: BulkAction[];
  onClear: () => void;
}

export default function BulkActionBar({ selectedCount, selectedIds, actions, onClear }: Props) {
  if (selectedCount === 0) return null;

  return (
    <div
      className="flex items-center justify-between px-4 py-3 rounded-lg mb-4"
      style={{
        background: 'var(--accent)',
        color: '#ffffff',
      }}
    >
      <Typography.Text style={{ color: '#ffffff' }}>
        {selectedCount} selected
      </Typography.Text>
      <Space size="small">
        {actions.map((action) => (
          <Button
            key={action.key}
            size="small"
            danger={action.danger}
            onClick={() => { action.onClick(selectedIds); onClear(); }}
            style={action.danger ? {} : { color: '#ffffff', borderColor: 'rgba(255,255,255,0.3)' }}
            ghost={!action.danger}
          >
            {action.label}
          </Button>
        ))}
        <Button
          size="small"
          type="text"
          icon={<CloseOutlined />}
          onClick={onClear}
          style={{ color: '#ffffff' }}
        />
      </Space>
    </div>
  );
}
```

- [ ] **Step 2: Write OptimisticFeedback**

Write `src/components/ui/OptimisticFeedback.tsx`:

```typescript
'use client';

import { useEffect } from 'react';
import { message, Button } from 'antd';
import { UndoOutlined } from '@ant-design/icons';

interface Props {
  visible: boolean;
  successMessage: string;
  onUndo?: () => void;
  duration?: number; // seconds
}

export default function OptimisticFeedback({ visible, successMessage, onUndo, duration = 5 }: Props) {
  useEffect(() => {
    if (!visible) return;

    const key = `optimistic-${Date.now()}`;
    message.success({
      content: (
        <span>
          {successMessage}
          {onUndo && (
            <Button
              type="link"
              size="small"
              icon={<UndoOutlined />}
              onClick={() => {
                onUndo();
                message.destroy(key);
              }}
              style={{ marginLeft: 8 }}
            >
              Undo
            </Button>
          )}
        </span>
      ),
      key,
      duration,
    });
  }, [visible, successMessage, onUndo, duration]);

  return null;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/BulkActionBar.tsx src/components/ui/OptimisticFeedback.tsx
git commit -m "feat: add BulkActionBar + OptimisticFeedback components"
```

---

### Task 3.5: Create Dashboard Widget system

**Files:**
- Create: `src/components/dashboard/WidgetRegistry.ts`
- Create: `src/components/dashboard/WidgetContainer.tsx`

- [ ] **Step 1: Write WidgetRegistry**

Write `src/components/dashboard/WidgetRegistry.ts`:

```typescript
import type { ComponentType } from 'react';

export interface WidgetDefinition {
  id: string;
  title: string;
  description: string;
  component: ComponentType<{ refreshInterval?: number }>;
  defaultSize: 'small' | 'medium' | 'large';
  roles?: string[]; // If set, only visible to these roles
}

const registry = new Map<string, WidgetDefinition>();

export function registerWidget(def: WidgetDefinition): void {
  registry.set(def.id, def);
}

export function getWidget(id: string): WidgetDefinition | undefined {
  return registry.get(id);
}

export function getWidgetsForRole(role: string): WidgetDefinition[] {
  return Array.from(registry.values()).filter(
    (w) => !w.roles || w.roles.includes(role),
  );
}

export function getAllWidgets(): WidgetDefinition[] {
  return Array.from(registry.values());
}
```

- [ ] **Step 2: Write WidgetContainer**

Write `src/components/dashboard/WidgetContainer.tsx`:

```typescript
'use client';

import { Card } from 'antd';
import { getWidget } from './WidgetRegistry';

interface Props {
  widgetId: string;
  refreshInterval?: number;
  onRemove?: () => void;
}

export default function WidgetContainer({ widgetId, refreshInterval, onRemove }: Props) {
  const widget = getWidget(widgetId);

  if (!widget) {
    return (
      <Card size="small" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
        <p style={{ color: 'var(--text-muted)' }}>Widget "{widgetId}" not found</p>
      </Card>
    );
  }

  const WidgetComponent = widget.component;

  return (
    <Card
      title={widget.title}
      size="small"
      extra={onRemove ? <button onClick={onRemove} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button> : undefined}
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
    >
      <WidgetComponent refreshInterval={refreshInterval} />
    </Card>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/WidgetRegistry.ts src/components/dashboard/WidgetContainer.tsx
git commit -m "feat: add Dashboard Widget system (registry + container)"
```

---

### Task 3.6: Add targeted tests

**Files:**
- Create: `tests/unit/sanitize.test.ts`
- Create: `tests/unit/focus-manager.test.ts`
- Create: `tests/unit/FilterBar.test.tsx`
- Create: `tests/unit/ThemeToggle.test.tsx`
- Create: `tests/unit/EmptyState.test.tsx`
- Create: `tests/unit/BulkActionBar.test.tsx`
- Create: `tests/unit/themeStore.test.ts`

- [ ] **Step 1: Write sanitize.test.ts**

Write `tests/unit/sanitize.test.ts`:

```typescript
import { sanitizeHtml, sanitizeText, stripHtml } from '@/lib/sanitize';

describe('sanitizeHtml', () => {
  it('allows safe tags', () => {
    expect(sanitizeHtml('<b>bold</b>')).toBe('<b>bold</b>');
    expect(sanitizeHtml('<a href="https://example.com">link</a>')).toContain('href="https://example.com"');
  });

  it('strips script tags', () => {
    expect(sanitizeHtml('<script>alert("xss")</script>')).not.toContain('<script>');
  });

  it('strips event handlers', () => {
    expect(sanitizeHtml('<img onerror="alert(1)">')).not.toContain('onerror');
  });

  it('returns empty string for empty input', () => {
    expect(sanitizeHtml('')).toBe('');
    expect(sanitizeHtml(null as unknown as string)).toBe('');
  });
});

describe('sanitizeText', () => {
  it('strips all HTML tags', () => {
    expect(sanitizeText('<b>hello</b>')).toBe('hello');
    expect(sanitizeText('<script>alert("xss")</script>test')).toBe('alert("xss")test');
  });
});

describe('stripHtml', () => {
  it('extracts plain text only', () => {
    expect(stripHtml('<p>Hello <b>World</b></p>')).toBe('Hello World');
  });
});
```

- [ ] **Step 2: Write themeStore.test.ts**

Write `tests/unit/themeStore.test.ts`:

```typescript
import { useUIStore } from '@/stores/uiStore';

describe('themeStore', () => {
  beforeEach(() => {
    useUIStore.setState({ themeMode: 'light' });
    localStorage.clear();
  });

  it('defaults to light theme', () => {
    expect(useUIStore.getState().themeMode).toBe('light');
  });

  it('setThemeMode changes mode and persists to localStorage', () => {
    useUIStore.getState().setThemeMode('dark');
    expect(useUIStore.getState().themeMode).toBe('dark');
    expect(localStorage.getItem('theme-mode')).toBe('dark');
  });

  it('supports all three modes', () => {
    useUIStore.getState().setThemeMode('system');
    expect(useUIStore.getState().themeMode).toBe('system');
    expect(localStorage.getItem('theme-mode')).toBe('system');
  });
});
```

- [ ] **Step 3: Write EmptyState.test.tsx**

Write `tests/unit/EmptyState.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import EmptyState from '@/components/ui/EmptyState';

describe('EmptyState', () => {
  it('renders description text', () => {
    render(<EmptyState description="No items found" />);
    expect(screen.getByText('No items found')).toBeInTheDocument();
  });

  it('renders action button when onAction is provided', () => {
    const onAction = jest.fn();
    render(<EmptyState description="Empty" actionLabel="Create" onAction={onAction} />);
    fireEvent.click(screen.getByText('Create'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('renders compact variant with smaller padding', () => {
    const { container } = render(<EmptyState variant="compact" />);
    expect(container.querySelector('.py-8')).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Write ThemeToggle.test.tsx**

Write `tests/unit/ThemeToggle.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { useUIStore } from '@/stores/uiStore';

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, string>) => {
    if (params) return key.replace('{mode}', params.mode);
    return key;
  },
}));

describe('ThemeToggle', () => {
  beforeEach(() => {
    useUIStore.setState({ themeMode: 'light' });
  });

  it('renders a button', () => {
    render(<ThemeToggle />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('cycles theme on click', () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button'));
    expect(useUIStore.getState().themeMode).toBe('dark');
  });
});
```

- [ ] **Step 5: Run tests**

Run: `npx jest tests/unit/ --verbose`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add tests/unit/
git commit -m "test: add unit tests for sanitize, themeStore, EmptyState, ThemeToggle"
```

---

### Task 3.7: Final verification + audit

- [ ] **Step 1: Run full test suite**

Run: `npx jest --verbose`
Expected: All existing + new tests pass

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No new warnings

- [ ] **Step 4: Run a11y audit**

Run: `npx @axe-core/playwright --browser chromium <url>`
Or: verify axe-core CI integration is working

- [ ] **Step 5: Run hardcoded colors check**

Run: `bash .github/workflows/scripts/check-hardcoded-colors.sh`
Expected: `✓ No hardcoded colors found in TSX files.`

- [ ] **Step 6: Visual verification**

Run: `npm run dev`
Walk through all pages:
- Login — white bg, proper spacing
- Dashboard — warm bg, amber KPI accents
- Avatars list — white card table
- Marketplace — white card grid
- Settings — clean form
- Mobile viewport (Chrome DevTools) — drawer sidebar, responsive grid

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: final verification — all tests pass, no type errors, clean audit"
```

---

## Total: 8 days across 3 phases, 24 tasks
