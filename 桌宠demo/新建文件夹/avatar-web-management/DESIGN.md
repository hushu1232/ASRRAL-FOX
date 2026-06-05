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
- ✅ Use CSS variables for ALL colors: `style={{ color: 'var(--text-primary)' }}`
- ✅ Use Ant Design components as primary UI building blocks
- ✅ Use better-icons (Lucide) for custom icons, @ant-design/icons only inside antd component props
- ✅ All interactive elements MUST have visible focus rings (3px `var(--accent-glow)`)
- ✅ All images MUST have `alt` text
- ✅ Forms MUST have associated `<label>` elements

### DON'T
- ❌ NEVER hardcode `#` hex colors or `rgba()` in TSX/JSX — use CSS variables
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
