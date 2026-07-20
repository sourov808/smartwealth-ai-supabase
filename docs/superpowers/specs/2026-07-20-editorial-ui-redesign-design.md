# Editorial Ledger — UI Redesign

**Date:** 2026-07-20
**Scope:** Full frontend visual redesign of Track (landing, auth, shell, four dashboard pages, chat, modals, loading states).

## Problem

The current UI reads as boring. The cause is not one bad choice but three structural ones:

1. **No hierarchy.** Nearly every surface is the same `bg-card border border-border rounded-xl p-6 shadow-xs` box. When everything is a card, nothing is emphasized. The balance — the single most important number in a finance app — is set at roughly the same size as a section heading.
2. **Palette without intent.** The Notion-derived greys are used inconsistently: `stone-*`, `zinc-*`, and `neutral-*` all appear, doing the same job with different values. `emerald-500` and `amber-600` appear in the Gmail card only, unrelated to the sage/rust/amber tokens used everywhere else.
3. **Duplicated markup.** Buttons, inputs, badges, meters, empty states, and skeletons are hand-rolled per file. There is no primitives layer, so a visual change means editing a dozen files, which in practice means visual drift.

The redesign fixes all three. The token system fixes the palette, the primitives layer fixes the duplication, and the editorial direction fixes the hierarchy.

## Direction: Editorial Ledger

Warm paper and ink. Serif display numerals, hairline rules instead of card borders, generous whitespace, one accent color. Solid surfaces only — no glassmorphism, no backdrop blur.

The bet: finance dashboards all look like each other because they all reach for the same card grid. Setting financial data as an editorial page — the way a broadsheet sets a market table — is both distinctive and functionally honest, because financial data *is* tabular and rules read tabular data better than boxes do.

**Constraint:** the direction lives or dies on spacing discipline. Removing card borders removes the structure they provided; that structure must be replaced by consistent rhythm (the `--space-*` tokens) and hairlines, not by nothing.

## 1. Token layer

`app/globals.css` is replaced. Every value below is a CSS custom property consumed through Tailwind v4's `@theme inline`.

### Surfaces

| Token | Light | Dark |
|---|---|---|
| `--paper` | `#FAF8F3` | `#141311` |
| `--paper-raised` | `#FFFFFF` | `#1C1A18` |
| `--ink` | `#1A1815` | `#EDE9E1` |
| `--ink-muted` | `#6B655C` | `#9A938A` |
| `--ink-faint` | `#9C958B` | `#6B655C` |
| `--rule` | `#E3DED4` | `#2A2724` |
| `--rule-strong` | `#C9C2B5` | `#3D3935` |

### Accent and semantics

| Token | Light | Dark |
|---|---|---|
| `--accent` | `#8C2F26` (oxblood) | `#E0705F` (clay) |
| `--accent-soft` | `#F5E9E7` | `#2B1D1A` |
| `--pos` | `#4A7C59` | `#7FB08D` |
| `--neg` | `#A34237` | `#E08573` |
| `--warn` | `#B07419` | `#D9A34A` |

`--pos` / `--neg` replace `--color-sage` / `--color-rust`. The names describe role, not hue, so a future palette change does not require renaming across the codebase.

### Chart series

`--series-1` through `--series-8`, derived from the accent and neutral families so charts read as part of the page rather than as a pasted-in widget. This replaces the hardcoded `COLORS` array in `analytics-client.tsx`, which currently mixes brand tokens with raw Tailwind hexes (`#8b5cf6`, `#3b82f6`, `#f97316`, `#14b8a6`, `#ec4899`).

### Type scale

| Token | Size | Face | Use |
|---|---|---|---|
| `--text-display` | `clamp(2.75rem, 5vw, 3.5rem)` | Instrument Serif | Hero balance |
| `--text-figure` | `1.875rem` | Instrument Serif | Secondary figures, KPIs |
| `--text-title` | `1.125rem` | Instrument Serif | Page and section titles |
| `--text-body` | `0.875rem` | Plus Jakarta Sans | Body, rows, controls |
| `--text-label` | `0.6875rem` | Plus Jakarta Sans, `0.12em` tracking, uppercase | Eyebrow labels |
| `--text-micro` | `0.625rem` | Plus Jakarta Sans | Meta, timestamps |

Money is always Geist Mono with `font-variant-numeric: tabular-nums`, so digits align vertically in any column.

### Rhythm

`--space-section: 3.5rem`, `--space-block: 1.5rem`, `--space-tight: 0.5rem`. Sections are separated by `--space-section` plus a hairline, never by a card boundary.

### Fonts

Instrument Serif added in `app/layout.tsx` via `next/font/google` as `--font-serif`. Plus Jakarta Sans (`--font-sans`) and Geist Mono (`--font-geist-mono`) are unchanged.

## 2. Theme mechanism

Moves from `@media (prefers-color-scheme: dark)` to `html[data-theme="light"|"dark"]`.

- First visit: a small blocking inline script in `app/layout.tsx` reads `localStorage.theme`, falls back to `matchMedia("(prefers-color-scheme: dark)")`, and sets `data-theme` **before first paint**. Blocking is deliberate — a deferred script produces a flash of the wrong theme.
- `components/ui/theme-toggle.tsx` writes `localStorage.theme` and updates the attribute. It lives in the sidebar's user menu.
- The toggle renders `null` until mounted, so server and client markup agree and hydration does not warn.

## 3. Primitives — `components/ui/`

Each file has one purpose and is independently understandable.

| File | Purpose | Replaces |
|---|---|---|
| `surface.tsx` | The one panel. Variants `flat` (hairline only), `raised`, `inset`. | ~11 copies of the card className |
| `stack.tsx` | Section wrapper: eyebrow label, optional action link, hairline, children | Every `flex items-center justify-between` + `h2` header |
| `figure.tsx` | Editorial number: `label`, `value`, `delta?`, `size` (`display` \| `figure`) | `stat-card.tsx`, the 4 analytics KPI cards |
| `field.tsx` | Labelled input / select / textarea with icon slot | Input markup in modal, budgets form, auth card |
| `button.tsx` | Variants `primary` \| `ghost` \| `danger` \| `quiet`; sizes `sm` \| `md` | ~9 hand-rolled button classNames |
| `badge.tsx` | Category chip, type chip, status chip | 3 near-identical badge blocks |
| `meter.tsx` | Progress bar, owns the over/warn/ok threshold logic | Duplicated in `dashboard-client` and `budgets-client` |
| `money.tsx` | Signed, colored, tabular-mono amount | ~6 inline sign-and-color ternaries |
| `empty.tsx` | Empty state: hairline, one line of copy, optional action | 6 ad-hoc "no data" divs |
| `skeleton.tsx` | Shimmer primitive honoring tokens | 3 loading files using hardcoded `bg-zinc-900` |
| `theme-toggle.tsx` | Light/dark control | new |

**Threshold logic moves into `meter.tsx`.** Today the 80%-warning and over-limit rules are written out twice, in `dashboard-client.tsx` and `budgets-client.tsx`. Two copies of a business rule is a bug waiting to happen; the primitive owns it.

`lib/utils.ts` gains:
- `formatDelta(current, previous)` → `{ pct, direction, label }`
- `formatCompact(n)` → `"$12.4k"` for axis ticks

## 4. Motion — `lib/motion.ts`

Exports exactly three variants: `fadeUp`, `stagger`, `drawerSpring`. Every animated component imports from here; no component defines its own timing. All variants respect `prefers-reduced-motion` by collapsing to instant.

## 5. Shell

`components/layout/sidebar.tsx` currently contains the desktop rail, the mobile top bar, and the mobile drawer. It splits into:

- `sidebar.tsx` — desktop rail
- `mobile-nav.tsx` — top bar and drawer
- `nav-items.ts` — the route list, single source of truth (currently duplicated between rail and drawer)
- `user-menu.tsx` — profile, logout, theme toggle

Visually: the rail drops its right border and background fills. Nav labels are lowercase sans. The active item is marked by a short oxblood rule to the left of the label, replacing the filled grey pill. The "Track" wordmark is set in Instrument Serif.

## 6. Pages

### Overview — `app/dashboard/`
Hero balance at `--text-display` with a delta line beneath (`↑ 4.2% · $498 more than June`). Hairline. Then income / expenses / saved as three `figure` components in a row, unboxed. Recent transactions become a ruled list, not a bordered card. Budget meters occupy the right column. The Gmail card is demoted from a full panel to a quiet single-line row — it is a settings concern, not a dashboard headline.

### Transactions — `app/dashboard/transactions/`
Stays a `<table>`; that is the right element for tabular data and screen readers depend on it. It loses the card wrapper and the filled `thead` background, keeping hairlines only. Amounts are right-aligned mono so digits align down the column. The filter bar becomes an inline row rather than a boxed four-column grid.

### Analytics — `app/dashboard/analytics/`
The four KPIs become `figure` components on a single ruled band. Charts lose their card chrome; each becomes a titled ruled block. Recharts restyling:
- Axis lines and tick lines removed entirely (`axisLine={false}`, `tickLine={false}`)
- One horizontal grid only, at `--rule`, no dash pattern
- Series colors from `--series-*`
- Tooltip rebuilt on `surface` with `--text-label` headers
- Area fills drop to `0.08` opacity; the stroke carries the signal

### Budgets — `app/dashboard/budgets/`
The form sits in a left column under a rule. The budget list becomes ruled rows with full-width hairline meters, replacing the two-column card grid.

### Landing and auth — `app/page.tsx`, `components/auth/`
`app/page.tsx` remains a session gate, not a marketing page. Adding a marketing hero would show a pitch to signed-in users during the redirect and expand scope without serving the product. It stays centered, restyled: serif wordmark, one italic serif tagline, and an auth card that drops its border to become type on paper. The 800ms artificial delay before the session check is removed — it is latency theater and makes the app feel slower, not more premium.

### Chat assistant — `components/dashboard/chat-assistant.tsx`
The drawer keeps its slide-in. `backdrop-blur-xs` is removed per the no-glass constraint; the backdrop becomes a flat ink scrim. Message bubbles become ruled blocks with a serif attribution label instead of filled rounded pills. The file is large and mixes SSE transport, markdown rendering, and presentation; markdown rendering extracts to `components/dashboard/chat/message-content.tsx` and the confirmation card to `components/dashboard/chat/confirm-card.tsx`.

### Loading states — three `loading.tsx` files
All rewritten on `skeleton.tsx`. The current implementations hardcode `bg-zinc-900`, which renders as near-black blocks in light mode and near-invisible in dark. This is a live bug, not only a style issue.

## 7. Deletions

- `components/dashboard/stat-card.tsx` → `figure.tsx`
- The hardcoded `COLORS` array in `analytics-client.tsx`
- All `bg-zinc-900` skeleton markup
- Every `stone-*`, `zinc-*`, `neutral-*`, `emerald-*`, `amber-*` utility class in components — replaced by tokens
- Every `dark:` variant made redundant by `data-theme` tokens
- The 800ms delay in `app/page.tsx`
- Duplicated button, input, badge, meter, and empty-state markup listed in §3

## Non-goals

- No new features. No data model changes. No Notion integration (deferred).
- No component library dependency. Tailwind v4 tokens plus local primitives only.
- No marketing site.
- No changes to `app/api/`, `lib/supabase/`, `lib/integrations/`, or the `agents/` service.

## Verification

- `npm run build` and `npm run lint` pass.
- Every page renders in both themes; toggle persists across reload with no flash of wrong theme.
- No raw color utility (`stone-`, `zinc-`, `neutral-`, `emerald-`, `amber-`, `slate-`, `gray-`) remains under `app/` or `components/`, confirmed by grep.
- Charts legible in both themes.
- Keyboard focus visible on every interactive element against paper and ink.
- Reduced-motion preference suppresses all animation.
