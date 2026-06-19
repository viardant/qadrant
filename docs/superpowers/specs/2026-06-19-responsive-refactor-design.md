# Responsive Refactor: CSS Media Queries → JS-Driven Breakpoints

**Date:** 2026-06-19
**Status:** Approved
**Scope:** Full app

## Problem

CSS media queries are not reliably applying in the development environment. Evidence:
- Vite dev server running, viewport at 430px
- CSS file contains the rules, build passes
- Hard refresh performed
- Rules do not apply — no visual change

The root cause is undiagnosed (Vite HMR issue, browser cache, or CSS pipeline bug), but the symptom is clear: **viewport-width-dependent layout cannot reliably live in CSS media queries in this environment.**

The current app has 35 `@media` blocks, 8 distinct breakpoints, and 0 JS-side viewport detection. Every responsive concern is CSS-driven.

## Solution

Move all viewport-width-dependent layout values to JavaScript. Use a `useBreakpoint` hook as the single source of truth. Apply responsive values via inline styles or conditional rendering.

Keep in CSS: capability queries (`(hover: hover)`, `(prefers-reduced-motion: reduce)`) and native responsive features (`clamp()`, `env()`).

## Architecture

### Breakpoint model

| Breakpoint | Range | `matchMedia` query |
|---|---|---|
| `mobile` | ≤640px | `(max-width: 640px)` |
| `tablet` | 641–1023px | `(min-width: 641px) and (max-width: 1023px)` |
| `desktop` | ≥1024px | `(min-width: 1024px)` |

### Hook: `useBreakpoint`

**Location:** `src/hooks/useBreakpoint.ts`

**Return shape:**
```ts
type Breakpoint = 'mobile' | 'tablet' | 'desktop';

interface BreakpointInfo {
  breakpoint: Breakpoint;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}
```

**Behavior:**
- SSR-safe: returns `{ breakpoint: 'desktop', isMobile: false, isTablet: false, isDesktop: true }` on first render
- In `useEffect`, attaches `matchMedia.addEventListener('change', ...)` for all three queries
- Updates state on breakpoint crossing
- Cleans up listeners on unmount
- Guards against `window`/`matchMedia` unavailability (returns desktop defaults)

### Hook: `useResponsiveValue`

**Location:** `src/hooks/useResponsiveValue.ts`

**Signature:**
```ts
function useResponsiveValue<T>(values: { mobile?: T; tablet?: T; desktop: T }): T;
```

**Behavior:**
- Calls `useBreakpoint()` internally
- Returns the value matching the current breakpoint
- Falls back to `desktop` if a breakpoint key is missing

### Component patterns

**Pattern A: `compact` prop (for reusable presentational components)**
- Component accepts `compact: boolean` prop
- Parent calls `useBreakpoint()` and passes the prop
- Keeps component pure and testable
- Used for: `ComboCard`, `InsightCard`, `TopBar`

**Pattern B: Hook in component (for page-specific or single-use components)**
- Component calls `useBreakpoint()` directly
- Used for: `RecentActivity`, `ActiveTimer`, `ActiveSessionStageDrop`, `KeyboardShortcuts`, `Modal`, `Fab`, `Heatmap`, `TabBar`, `AppLayout`

**Style application:**
- Presentational values (padding, font-size, gap): inline `style` prop with values from `useResponsiveValue`
- Structural differences (show/hide, different children): conditional rendering

## Component changes

### New files (4)
- `src/hooks/useBreakpoint.ts` — viewport detection hook
- `src/hooks/useBreakpoint.test.ts` — unit tests
- `src/hooks/useResponsiveValue.ts` — breakpoint-keyed value helper
- `src/hooks/useResponsiveValue.test.ts` — unit tests

### Modified files

**Layout:**
- `src/components/layout/AppLayout.tsx` — apply container padding + page bottom padding via inline style from `useResponsiveValue`
- `src/components/layout/TabBar.tsx` — show labels when `!isMobile`, icons only when `isMobile`

**UI chrome:**
- `src/components/ui/TopBar.tsx` — accept `compact: boolean`; when true, skip `.top-bar__timestamp` and suffix spans; wordmark is just `QADRANT // {section}`. Apply row layout (column vs row) via inline style.
- `src/components/ui/Modal.tsx` — when `isMobile`, top-aligned full-width sheet with stacked full-width actions
- `src/components/ui/Fab.tsx` — apply responsive padding/font-size
- `src/components/ui/Heatmap.tsx` — when `isMobile`, 12px cells; when desktop, 14px cells
- `src/components/ui/InsightCard.tsx` — accept `compact: boolean`; apply responsive padding/font-size

**Timer components:**
- `src/components/timer/ComboCard.tsx` — accept `compact: boolean`; when true, skip `.combo-card__caret` and `.combo-card__category`
- `src/components/timer/QuickReplay.tsx` — call `useBreakpoint()`; pass `compact={isMobile}` to each ComboCard
- `src/components/timer/RecentActivity.tsx` — call `useBreakpoint()`; when `isMobile`, single-row compact layout; when desktop, 3-column grid
- `src/components/timer/ActiveTimer.tsx` — call `useBreakpoint()`; when `isMobile`, centered column with large digit; when desktop, row layout
- `src/components/timer/ActiveSessionStageDrop.tsx` — call `useBreakpoint()`; when `isMobile`, single-column + full-width stop; when desktop, 2-column grid
- `src/components/timer/KeyboardShortcuts.tsx` — when `!isDesktop`, return `null` (no DOM)

**Pages:**
- `src/pages/Timer.tsx` — pass `compact={isMobile}` to `TopBar`
- `src/pages/Ledger.tsx` — call `useBreakpoint()`; when `isMobile`, stacked flex column with full-width action buttons and 44px touch targets
- `src/pages/Settings.tsx` — call `useBreakpoint()`; when `isMobile`, single-column color grid, stacked token rows, full-width buttons

**CSS:**
- `src/index.css` — remove ALL viewport-width `@media` blocks. Keep `(hover: hover)` and `(prefers-reduced-motion: reduce)`. Keep `clamp()` and `env()` usage.

**Tests:**
- `src/test/setup.ts` — add `window.matchMedia` mock
- `src/test/helpers.ts` (new) — `setBreakpoint('mobile' | 'tablet' | 'desktop')` test helper

## Responsive value table

| Property | Mobile | Tablet | Desktop |
|---|---|---|---|
| Container padding-inline | 4px | 8px | 64px |
| Page padding-bottom | 72 + 32 + safe-area | 72 + 32 + safe-area | 72 + 64 + safe-area |
| Section padding-block | 16px | 24px | 24px |
| TopBar row direction | column | row | row |
| TabBar labels | hidden | shown | shown |
| InsightCard padding | 16px | 20px | 32px |
| Stage drop padding | 24/16 | 48/20 | 96/64 |
| FAB padding/font | base | base | 32/16px/16px |
| Heatmap cell size | 12px | 14px | 14px |
| ActiveTimer layout | column, 40-56px digit | row | row |
| ComboCard caret/category | hidden | shown | shown |
| RecentActivity layout | single-row compact | single-row compact | 3-column grid |
| KeyboardShortcuts | hidden | hidden | shown |
| Modal layout | top-aligned full-width | centered | centered |
| Ledger row | stacked column | grid | grid |
| Settings color grid | 1-column | auto-fit | auto-fit |

## Migration order

1. Add `useBreakpoint` + `useResponsiveValue` hooks with tests
2. Add `matchMedia` mock to test setup + `setBreakpoint` helper
3. Convert components one at a time (keep old CSS media queries in place until JS version works)
4. Final pass: remove all viewport-width `@media` blocks from CSS
5. Visual testing at 375px, 768px, 1280px

## Error handling

- **matchMedia unavailable:** hook returns desktop defaults, no crash
- **Hydration mismatch (future SSR):** initial render is desktop, `useEffect` updates to actual value; acceptable visual flash
- **Resize during render:** `matchMedia` change events are synchronous, React batches re-renders
- **Missing breakpoint key in `useResponsiveValue`:** falls back to `desktop` value

## Testing strategy

**New unit tests:**
- `useBreakpoint.test.ts` — breakpoint detection, SSR, matchMedia unavailable, resize events
- `useResponsiveValue.test.ts` — value resolution, fallback behavior

**Updated component tests:**
- `ComboCard` — render with `compact={true}` and `compact={false}`
- `RecentActivity` — render at both breakpoints
- `ActiveTimer`, `ActiveSessionStageDrop` — render at both breakpoints
- `KeyboardShortcuts` — verify returns `null` when not desktop

**Updated integration tests:**
- `Timer.test.tsx`, `Ledger.test.tsx`, `Stats.test.tsx` — add mobile layout assertions

**Visual regression (manual):**
- 375px (iPhone SE), 390px (iPhone 13), 768px (iPad portrait), 1024px (iPad landscape), 1440px (desktop)
- Verify: no horizontal scroll, all touch targets ≥44px, text readable, no layout breaks

**Coverage target:** 100% line coverage on new hooks, no regression in existing 169 tests.
