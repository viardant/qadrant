# Responsive Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all viewport-width CSS media queries with JS-driven `useBreakpoint` hook and inline styles/conditional rendering.

**Architecture:** Single `useBreakpoint` hook using `window.matchMedia` as source of truth. Components either call the hook directly or receive a `compact: boolean` prop. Responsive values applied via inline `style` or conditional render. CSS retains only capability queries (`(hover: hover)`, `(prefers-reduced-motion: reduce)`).

**Tech Stack:** React 19, TypeScript, Vite, Vitest, @testing-library/react

---

## File Structure

**New files:**
- `src/hooks/useBreakpoint.ts` — viewport detection hook
- `src/hooks/useBreakpoint.test.ts` — unit tests
- `src/hooks/useResponsiveValue.ts` — breakpoint-keyed value helper
- `src/hooks/useResponsiveValue.test.ts` — unit tests
- `src/test/helpers.ts` — `setBreakpoint` test utility

**Modified files:**
- `src/test/setup.ts` — add `matchMedia` mock
- `src/index.css` — remove all viewport-width `@media` blocks
- `src/components/layout/AppLayout.tsx` — container/page padding via hook
- `src/components/layout/TabBar.tsx` — label visibility via hook
- `src/components/ui/TopBar.tsx` — `compact` prop, conditional render
- `src/components/ui/Modal.tsx` — mobile sheet layout via hook
- `src/components/ui/Fab.tsx` — responsive sizing via hook
- `src/components/ui/Heatmap.tsx` — cell size via hook
- `src/components/ui/InsightCard.tsx` — `compact` prop
- `src/components/timer/ComboCard.tsx` — `compact` prop
- `src/components/timer/QuickReplay.tsx` — pass `compact` to ComboCard
- `src/components/timer/RecentActivity.tsx` — mobile layout via hook
- `src/components/timer/ActiveTimer.tsx` — mobile restack via hook
- `src/components/timer/ActiveSessionStageDrop.tsx` — mobile layout via hook
- `src/components/timer/KeyboardShortcuts.tsx` — return null on non-desktop
- `src/pages/Timer.tsx` — pass `compact` to TopBar
- `src/pages/Ledger.tsx` — mobile row layout via hook
- `src/pages/Settings.tsx` — mobile layout via hook

---

## Task 1: Add matchMedia mock to test setup

**Files:**
- Modify: `src/test/setup.ts`

- [ ] **Step 1: Read current setup file**

Read `src/test/setup.ts` to see existing content.

- [ ] **Step 2: Add matchMedia mock**

Add to `src/test/setup.ts`:

```ts
import '@testing-library/jest-dom';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
});
```

- [ ] **Step 3: Verify tests still pass**

Run: `npm run test -- --run`
Expected: All 169 existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/test/setup.ts
git commit -m "test: add matchMedia mock for jsdom"
```

---

## Task 2: Create useBreakpoint hook

**Files:**
- Create: `src/hooks/useBreakpoint.ts`
- Create: `src/hooks/useBreakpoint.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useBreakpoint.test.ts`:

```ts
import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useBreakpoint, setBreakpoint } from './useBreakpoint';

describe('useBreakpoint', () => {
  beforeEach(() => {
    setBreakpoint('desktop');
  });

  it('returns desktop by default', () => {
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current.isDesktop).toBe(true);
    expect(result.current.isMobile).toBe(false);
  });

  it('returns mobile when viewport is <=640px', () => {
    setBreakpoint('mobile');
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current.isMobile).toBe(true);
    expect(result.current.isDesktop).toBe(false);
  });

  it('returns tablet when viewport is 641-1023px', () => {
    setBreakpoint('tablet');
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current.isTablet).toBe(true);
  });

  it('returns desktop when viewport is >=1024px', () => {
    setBreakpoint('desktop');
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current.isDesktop).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/hooks/useBreakpoint.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the hook and test helper**

Create `src/hooks/useBreakpoint.ts`:

```ts
import { useEffect, useState } from 'react';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

export interface BreakpointInfo {
  breakpoint: Breakpoint;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

const MOBILE_QUERY = '(max-width: 640px)';
const TABLET_QUERY = '(min-width: 641px) and (max-width: 1023px)';
const DESKTOP_QUERY = '(min-width: 1024px)';

const DESKTOP_DEFAULT: BreakpointInfo = {
  breakpoint: 'desktop',
  isMobile: false,
  isTablet: false,
  isDesktop: true,
};

function detectBreakpoint(): BreakpointInfo {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return DESKTOP_DEFAULT;
  }
  if (window.matchMedia(MOBILE_QUERY).matches) {
    return { breakpoint: 'mobile', isMobile: true, isTablet: false, isDesktop: false };
  }
  if (window.matchMedia(TABLET_QUERY).matches) {
    return { breakpoint: 'tablet', isMobile: false, isTablet: true, isDesktop: false };
  }
  return DESKTOP_DEFAULT;
}

const listeners = new Set<(info: BreakpointInfo) => void>();
let currentBreakpoint: BreakpointInfo = DESKTOP_DEFAULT;

if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  currentBreakpoint = detectBreakpoint();

  const update = () => {
    currentBreakpoint = detectBreakpoint();
    listeners.forEach((fn) => fn(currentBreakpoint));
  };

  window.matchMedia(MOBILE_QUERY).addEventListener('change', update);
  window.matchMedia(TABLET_QUERY).addEventListener('change', update);
  window.matchMedia(DESKTOP_QUERY).addEventListener('change', update);
}

export function setBreakpoint(bp: Breakpoint): void {
  const info: BreakpointInfo =
    bp === 'mobile'
      ? { breakpoint: 'mobile', isMobile: true, isTablet: false, isDesktop: false }
      : bp === 'tablet'
        ? { breakpoint: 'tablet', isMobile: false, isTablet: true, isDesktop: false }
        : DESKTOP_DEFAULT;
  currentBreakpoint = info;
  listeners.forEach((fn) => fn(info));
}

export function useBreakpoint(): BreakpointInfo {
  const [, setForce] = useState(0);

  useEffect(() => {
    const fn = () => setForce((n) => n + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  return currentBreakpoint;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/hooks/useBreakpoint.test.ts`
Expected: PASS — all 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useBreakpoint.ts src/hooks/useBreakpoint.test.ts
git commit -m "feat(hooks): add useBreakpoint hook"
```

---

## Task 3: Create useResponsiveValue hook

**Files:**
- Create: `src/hooks/useResponsiveValue.ts`
- Create: `src/hooks/useResponsiveValue.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useResponsiveValue.test.ts`:

```ts
import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useBreakpoint, setBreakpoint } from './useBreakpoint';
import { useResponsiveValue } from './useResponsiveValue';

describe('useResponsiveValue', () => {
  beforeEach(() => {
    setBreakpoint('desktop');
  });

  it('returns desktop value by default', () => {
    const { result } = renderHook(() => useResponsiveValue({ mobile: 4, desktop: 64 }));
    expect(result.current).toBe(64);
  });

  it('returns mobile value when on mobile', () => {
    setBreakpoint('mobile');
    const { result } = renderHook(() => useResponsiveValue({ mobile: 4, desktop: 64 }));
    expect(result.current).toBe(4);
  });

  it('falls back to desktop when mobile key missing', () => {
    setBreakpoint('mobile');
    const { result } = renderHook(() => useResponsiveValue({ desktop: 64 }));
    expect(result.current).toBe(64);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/hooks/useResponsiveValue.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the hook**

Create `src/hooks/useResponsiveValue.ts`:

```ts
import { useBreakpoint } from './useBreakpoint';

export function useResponsiveValue<T>(values: { mobile?: T; tablet?: T; desktop: T }): T {
  const { breakpoint } = useBreakpoint();
  if (breakpoint === 'mobile' && values.mobile !== undefined) return values.mobile;
  if (breakpoint === 'tablet' && values.tablet !== undefined) return values.tablet;
  return values.desktop;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/hooks/useResponsiveValue.test.ts`
Expected: PASS — all 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useResponsiveValue.ts src/hooks/useResponsiveValue.test.ts
git commit -m "feat(hooks): add useResponsiveValue hook"
```

---

## Task 4: Convert AppLayout container padding

**Files:**
- Modify: `src/components/layout/AppLayout.tsx`

- [ ] **Step 1: Read current AppLayout**

Read `src/components/layout/AppLayout.tsx`.

- [ ] **Step 2: Update AppLayout to use hook**

Replace contents of `src/components/layout/AppLayout.tsx`:

```tsx
import { Outlet } from 'react-router-dom';
import { TabBar } from './TabBar';
import { useResponsiveValue } from '../../hooks/useResponsiveValue';

const TAB_BAR_HEIGHT = 72;
const SPACE_8 = 32;
const SPACE_16 = 64;
const SPACE_2 = 8;
const SPACE_1 = 4;

export function AppLayout() {
  const paddingInline = useResponsiveValue({ mobile: SPACE_1, tablet: SPACE_2, desktop: SPACE_16 });
  const bottomBuffer = useResponsiveValue({ mobile: SPACE_8, tablet: SPACE_8, desktop: SPACE_16 });
  const isMobile = useResponsiveValue({ mobile: true, desktop: false });

  return (
    <div className="page-shell">
      <main
        className="container page"
        style={{
          paddingInline: `${paddingInline}px`,
          paddingBottom: `calc(${TAB_BAR_HEIGHT}px + ${bottomBuffer}px + env(safe-area-inset-bottom, 0px))`,
        }}
        data-mobile={isMobile ? 'true' : undefined}
      >
        <Outlet />
      </main>
      <TabBar />
    </div>
  );
}
```

- [ ] **Step 3: Build to verify no errors**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/AppLayout.tsx
git commit -m "refactor(layout): use JS-driven container padding"
```

---

## Task 5: Convert TabBar label visibility

**Files:**
- Modify: `src/components/layout/TabBar.tsx`

- [ ] **Step 1: Read current TabBar**

Read `src/components/layout/TabBar.tsx`.

- [ ] **Step 2: Update TabBar to use hook**

Add to imports at top of `src/components/layout/TabBar.tsx`:

```tsx
import { useBreakpoint } from '../../hooks/useBreakpoint';
```

In the component function, after the existing hooks/state:

```tsx
const { isMobile } = useBreakpoint();
```

Change the label rendering to:

```tsx
<span className="tab-bar__label" style={isMobile ? { display: 'none' } : undefined}>
  {tab.label}
</span>
```

(If the component has a different structure, adapt to hide labels when `isMobile` is true.)

- [ ] **Step 3: Build to verify no errors**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/TabBar.tsx
git commit -m "refactor(layout): use JS-driven tab bar label visibility"
```

---

## Task 6: Convert TopBar with compact prop

**Files:**
- Modify: `src/components/ui/TopBar.tsx`

- [ ] **Step 1: Read current TopBar**

Read `src/components/ui/TopBar.tsx`.

- [ ] **Step 2: Add compact prop**

Replace contents of `src/components/ui/TopBar.tsx`:

```tsx
import type { CSSProperties, ReactNode } from 'react';

interface Metadata {
  archiveId?: string;
  version?: string;
}

interface Props {
  section: string;
  timestamp?: string | null;
  metadata?: Metadata;
  rightSlot?: ReactNode;
  compact?: boolean;
}

export function TopBar({ section, timestamp, metadata, rightSlot, compact = false }: Props) {
  const hasMetadata = !!(metadata && (metadata.archiveId || metadata.version));
  const right = rightSlot ?? (
    hasMetadata ? (
      <span className="top-bar__meta">
        {metadata?.archiveId && (
          <>
            <span>ARCHIVE_ID:&nbsp;{metadata.archiveId}</span>
            <span className="top-bar__meta-sep">//</span>
          </>
        )}
        {metadata?.version && <span>{metadata.version}</span>}
        {(metadata?.archiveId || metadata?.version) && (
          <>
            <span className="top-bar__meta-sep">//</span>
            <span>⌘K&nbsp;–&nbsp;INDEX</span>
          </>
        )}
      </span>
    ) : (
      (timestamp ?? 'NO_RECENT_ACTIVITY')
    )
  );

  const rowStyle: CSSProperties = compact
    ? { flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }
    : {};

  return (
    <header className="top-bar">
      <div className="top-bar__row" style={rowStyle}>
        <div className="top-bar__wordmark top-bar__wordmark--accent">
          QADRANT&nbsp;//&nbsp;{section}
        </div>
        {!compact && <div className="top-bar__timestamp">{right}</div>}
      </div>
      <div className="top-bar__rule" />
    </header>
  );
}
```

- [ ] **Step 3: Build to verify no errors**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/TopBar.tsx
git commit -m "refactor(ui): add compact prop to TopBar"
```

---

## Task 7: Update Timer page to pass compact to TopBar

**Files:**
- Modify: `src/pages/Timer.tsx`

- [ ] **Step 1: Add useBreakpoint import and call**

In `src/pages/Timer.tsx`, add import:

```tsx
import { useBreakpoint } from '../hooks/useBreakpoint';
```

Inside the `Timer` component, add:

```tsx
const { isMobile } = useBreakpoint();
```

- [ ] **Step 2: Pass compact to TopBar**

Change:

```tsx
<TopBar
  section="TIMER"
  metadata={{ archiveId, version: 'VERIFIED_V2.1' }}
/>
```

To:

```tsx
<TopBar
  section="TIMER"
  metadata={{ archiveId, version: 'VERIFIED_V2.1' }}
  compact={isMobile}
/>
```

- [ ] **Step 3: Build to verify no errors**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Timer.tsx
git commit -m "refactor(timer): pass compact to TopBar"
```

---

## Task 8: Convert ComboCard with compact prop

**Files:**
- Modify: `src/components/timer/ComboCard.tsx`

- [ ] **Step 1: Read current ComboCard**

Read `src/components/timer/ComboCard.tsx`.

- [ ] **Step 2: Add compact prop**

Replace contents of `src/components/timer/ComboCard.tsx`:

```tsx
import type { CSSProperties } from 'react';
import type { Combo } from '../../lib/combos';

interface Props {
  combo: Combo;
  onStart: (combo: Combo) => void;
  compact?: boolean;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function comboLabel(space: string, specialization: string): string {
  if (!specialization) return space || 'Untitled';
  if (!space) return specialization;
  return `${space} / ${specialization}`;
}

const COMPACT_STYLE: CSSProperties = {
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  padding: '12px 16px',
  gap: '8px',
};

export function ComboCard({ combo, onStart, compact = false }: Props) {
  const label = comboLabel(combo.space, combo.specialization);
  return (
    <button
      type="button"
      className="combo-card"
      onClick={() => onStart(combo)}
      aria-label={`Start ${label}`}
      style={compact ? COMPACT_STYLE : undefined}
    >
      {!compact && <span className="combo-card__caret" aria-hidden>▸</span>}
      <div className="combo-card__main">
        {!compact && <span className="combo-card__category">{combo.category}</span>}
        <span
          className="combo-card__name"
          style={compact ? { fontSize: '15px' } : undefined}
        >
          {combo.space}
        </span>
        {combo.specialization && (
          <span
            className="combo-card__specialization"
            style={compact ? { fontSize: '12px' } : undefined}
          >
            {combo.specialization}
          </span>
        )}
        <span className="sr-only">{label}</span>
      </div>
      <span
        className="combo-card__meta"
        aria-hidden
        style={compact ? { fontSize: '10px', gap: '4px' } : undefined}
      >
        {!compact && <span className="combo-card__meta-square" />}
        {pad(combo.useCount)}&nbsp;USES
      </span>
    </button>
  );
}
```

- [ ] **Step 3: Build to verify no errors**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/timer/ComboCard.tsx
git commit -m "refactor(timer): add compact prop to ComboCard"
```

---

## Task 9: Convert QuickReplay to pass compact

**Files:**
- Modify: `src/components/timer/QuickReplay.tsx`

- [ ] **Step 1: Read current QuickReplay**

Read `src/components/timer/QuickReplay.tsx`.

- [ ] **Step 2: Add hook and pass compact**

Replace contents of `src/components/timer/QuickReplay.tsx`:

```tsx
import { Link } from 'react-router-dom';
import { EmptyState } from '../ui/EmptyState';
import { ComboCard } from './ComboCard';
import type { Combo } from '../../lib/combos';
import { useBreakpoint } from '../../hooks/useBreakpoint';

interface Props {
  combos: Combo[];
  total: number;
  onStart: (combo: Combo) => void;
  onCreate: () => void;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export function QuickReplay({ combos, total, onStart, onCreate }: Props) {
  const { isMobile } = useBreakpoint();
  return (
    <section className="section" aria-label="Quick replay">
      <div className="section__head">
        <span className="eyebrow">QUICK_REPLAY&nbsp;//&nbsp;MOST_USED</span>
        <span className="type-tech-mono-sm" style={{ color: 'var(--fg-muted)' }}>
          {pad(combos.length)}_OF_{pad(total)}
        </span>
      </div>
      {combos.length === 0 ? (
        <EmptyState
          title="ARCHIVE_EMPTY"
          message="NO_COMBOS_LOGGED"
          actionLabel=">>> NEW_COMBINATION"
          onAction={onCreate}
        />
      ) : (
        <div className="combo-grid" role="list">
          {combos.map((c) => (
            <div key={c.id} role="listitem" className="combo-grid__cell">
              <ComboCard combo={c} onStart={onStart} compact={isMobile} />
            </div>
          ))}
        </div>
      )}
      <div className="view-all-row">
        <Link to="/ledger" className="tunable">
          &gt;&gt;&gt;&nbsp;VIEW_ALL_COMBINATIONS
        </Link>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Build to verify no errors**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/timer/QuickReplay.tsx
git commit -m "refactor(timer): pass compact to ComboCard in QuickReplay"
```

---

## Task 10: Convert RecentActivity to mobile layout

**Files:**
- Modify: `src/components/timer/RecentActivity.tsx`

- [ ] **Step 1: Read current RecentActivity**

Read `src/components/timer/RecentActivity.tsx`.

- [ ] **Step 2: Add hook and conditional layout**

Replace contents of `src/components/timer/RecentActivity.tsx`:

```tsx
import type { CSSProperties } from 'react';
import type { TimeEntry } from '../../lib/time-entry';
import { getEntryDurationHours } from '../../lib/transform';
import { EmptyState } from '../ui/EmptyState';
import { useBreakpoint } from '../../hooks/useBreakpoint';

interface Props {
  entries: TimeEntry[];
  limit?: number;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatCompactStart(iso: string, now: Date): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '--';
  const today = new Date(now);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfEntry = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((startOfToday.getTime() - startOfEntry.getTime()) / (24 * 60 * 60_000));
  if (diffDays === 0) {
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return `Y_${diffDays}D`;
}

function formatDurationUpper(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  if (hours === 0) return `0H ${pad(minutes)}M`;
  return `${hours}H ${pad(minutes)}M`;
}

const COMPACT_ROW_STYLE: CSSProperties = {
  gridTemplateColumns: '64px minmax(0, 1fr) auto',
  columnGap: '8px',
};

export function RecentActivity({ entries, limit = 5 }: Props) {
  const { isMobile } = useBreakpoint();
  const completed = entries
    .filter((e) => e.completion_time)
    .sort(
      (a, b) =>
        new Date(b.start_date).getTime() - new Date(a.start_date).getTime(),
    )
    .slice(0, limit);

  const now = new Date();

  return (
    <section className="section" aria-label="Recent activity">
      <div className="section__head">
        <span className="eyebrow">RECENT_ACTIVITY</span>
        <span className="type-tech-mono-sm" style={{ color: 'var(--fg-muted)' }}>
          LAST_{pad(limit)}
        </span>
      </div>
      {completed.length === 0 ? (
        <EmptyState
          title="NO_RECENT_ACTIVITY"
          message="NO_COMPLETED_SESSIONS"
        />
      ) : (
        <div className="recent-list">
          {completed.map((e) => {
            const ms = getEntryDurationHours(e) * 60 * 60_000;
            const label = e.specialization
              ? `${e.space || 'Untitled'} / ${e.specialization}`
              : e.space || 'Untitled';
            return (
              <div
                key={e.id}
                className="recent-row"
                style={isMobile ? COMPACT_ROW_STYLE : undefined}
              >
                <span
                  className="recent-row__time"
                  style={isMobile ? { fontSize: '12px' } : undefined}
                >
                  {formatCompactStart(e.start_date, now)}
                </span>
                <span
                  className="recent-row__label"
                  style={isMobile ? { fontSize: '13px' } : undefined}
                >
                  {label}
                </span>
                <span
                  className="recent-row__duration"
                  style={isMobile ? { fontSize: '12px' } : undefined}
                >
                  {formatDurationUpper(ms)}
                  {!isMobile && <span className="recent-row__caret" aria-hidden> ▸</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Build to verify no errors**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/timer/RecentActivity.tsx
git commit -m "refactor(timer): use JS-driven compact layout in RecentActivity"
```

---

## Task 11: Convert ActiveTimer to mobile layout

**Files:**
- Modify: `src/components/timer/ActiveTimer.tsx`

- [ ] **Step 1: Read current ActiveTimer**

Read `src/components/timer/ActiveTimer.tsx`.

- [ ] **Step 2: Add hook and conditional layout**

Add to imports:

```tsx
import { useBreakpoint } from '../../hooks/useBreakpoint';
```

Inside the component:

```tsx
const { isMobile } = useBreakpoint();
```

Apply mobile styles via inline `style` prop on the main container and child elements. Key changes when `isMobile`:
- Container: `flexDirection: 'column'`, `alignItems: 'stretch'`, `textAlign: 'center'`, `padding: '32px 20px'`, `gap: '16px'`
- Digits: `fontSize: 'clamp(40px, 12vw, 56px)'`, `alignSelf: 'center'`
- Stop button: `width: '100%'`, `padding: '16px'`, `fontSize: '13px'`

- [ ] **Step 3: Build to verify no errors**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/timer/ActiveTimer.tsx
git commit -m "refactor(timer): use JS-driven mobile layout in ActiveTimer"
```

---

## Task 12: Convert ActiveSessionStageDrop to mobile layout

**Files:**
- Modify: `src/components/timer/ActiveSessionStageDrop.tsx`

- [ ] **Step 1: Read current ActiveSessionStageDrop**

Read `src/components/timer/ActiveSessionStageDrop.tsx`.

- [ ] **Step 2: Add hook and conditional layout**

Add to imports:

```tsx
import { useBreakpoint } from '../../hooks/useBreakpoint';
```

Inside the component:

```tsx
const { isMobile, isDesktop } = useBreakpoint();
```

Apply mobile styles via inline `style`:
- Grid: `gridTemplateColumns: isDesktop ? 'minmax(0, 1.5fr) minmax(0, 1fr)' : '1fr'`, `gap: isDesktop ? '48px' : '0'`
- Padding: `padding: isMobile ? '32px 20px' : '48px 24px'`
- Stop button: `width: '100%'`, `textAlign: 'center'`, `padding: '16px'`, `fontSize: '13px'` when `isMobile`

- [ ] **Step 3: Build to verify no errors**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/timer/ActiveSessionStageDrop.tsx
git commit -m "refactor(timer): use JS-driven mobile layout in ActiveSessionStageDrop"
```

---

## Task 13: Convert KeyboardShortcuts to return null on non-desktop

**Files:**
- Modify: `src/components/timer/KeyboardShortcuts.tsx`

- [ ] **Step 1: Read current KeyboardShortcuts**

Read `src/components/timer/KeyboardShortcuts.tsx`.

- [ ] **Step 2: Add hook and early return**

Add to imports:

```tsx
import { useBreakpoint } from '../../hooks/useBreakpoint';
```

At the start of the component function:

```tsx
const { isDesktop } = useBreakpoint();
if (!isDesktop) return null;
```

- [ ] **Step 3: Build to verify no errors**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/timer/KeyboardShortcuts.tsx
git commit -m "refactor(timer): hide KeyboardShortcuts on non-desktop via JS"
```

---

## Task 14: Convert Modal to mobile sheet layout

**Files:**
- Modify: `src/components/ui/Modal.tsx`

- [ ] **Step 1: Read current Modal**

Read `src/components/ui/Modal.tsx`.

- [ ] **Step 2: Add hook and conditional styles**

Add to imports:

```tsx
import { useBreakpoint } from '../../hooks/useBreakpoint';
```

Inside the component:

```tsx
const { isMobile } = useBreakpoint();
```

Apply mobile styles:
- Overlay: `alignItems: isMobile ? 'flex-start' : 'center'`, `padding: isMobile ? '24px 16px' : '0'`, `overflowY: isMobile ? 'auto' : 'visible'`
- Modal: `margin: isMobile ? 'auto 0' : 'auto'`, `width: '100%'`, `maxWidth: isMobile ? 'none' : 'current'`, `padding: isMobile ? '20px' : 'current'`
- Actions: `flexDirection: isMobile ? 'column-reverse' : 'row'`, `alignItems: isMobile ? 'stretch' : 'center'`
- Action buttons: `width: '100%'`, `minHeight: '44px'`, `justifyContent: 'center'` when `isMobile`

- [ ] **Step 3: Build to verify no errors**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/Modal.tsx
git commit -m "refactor(ui): use JS-driven mobile sheet in Modal"
```

---

## Task 15: Convert Fab to responsive sizing

**Files:**
- Modify: `src/components/ui/Fab.tsx`

- [ ] **Step 1: Read current Fab**

Read `src/components/ui/Fab.tsx`.

- [ ] **Step 2: Add hook and responsive style**

Add to imports:

```tsx
import { useBreakpoint } from '../../hooks/useBreakpoint';
```

Inside the component:

```tsx
const { isDesktop } = useBreakpoint();
```

When `isDesktop` and className includes `fab--full`, apply `padding: '32px 16px'`, `fontSize: '16px'`.

- [ ] **Step 3: Build to verify no errors**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/Fab.tsx
git commit -m "refactor(ui): use JS-driven responsive sizing in Fab"
```

---

## Task 16: Convert Heatmap cell size

**Files:**
- Modify: `src/components/ui/Heatmap.tsx`

- [ ] **Step 1: Read current Heatmap**

Read `src/components/ui/Heatmap.tsx`.

- [ ] **Step 2: Add hook and responsive cell size**

Add to imports:

```tsx
import { useBreakpoint } from '../../hooks/useBreakpoint';
```

Inside the component:

```tsx
const { isMobile } = useBreakpoint();
const cellSize = isMobile ? 12 : 14;
```

Use `cellSize` for the inline `gridTemplateRows` and cell `width`/`height` instead of hardcoded values.

- [ ] **Step 3: Build to verify no errors**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/Heatmap.tsx
git commit -m "refactor(ui): use JS-driven cell size in Heatmap"
```

---

## Task 17: Convert InsightCard with compact prop

**Files:**
- Modify: `src/components/ui/InsightCard.tsx`

- [ ] **Step 1: Read current InsightCard**

Read `src/components/ui/InsightCard.tsx`.

- [ ] **Step 2: Add compact prop**

Add to props:

```tsx
compact?: boolean;
```

Apply mobile styles when `compact`:
- Container: `padding: '16px'` (or `'20px'` for tablet)
- Stat: `fontSize: 'clamp(20px, 2.5vw, 22px)'`

- [ ] **Step 3: Build to verify no errors**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/InsightCard.tsx
git commit -m "refactor(ui): add compact prop to InsightCard"
```

---

## Task 18: Convert Ledger page to mobile row layout

**Files:**
- Modify: `src/pages/Ledger.tsx`

- [ ] **Step 1: Read current Ledger**

Read `src/pages/Ledger.tsx`.

- [ ] **Step 2: Add hook and conditional row layout**

Add to imports:

```tsx
import { useBreakpoint } from '../hooks/useBreakpoint';
```

Inside the component:

```tsx
const { isMobile } = useBreakpoint();
```

Apply mobile styles to `.ledger-row`:
- `display: 'flex'`, `flexDirection: 'column'`, `alignItems: 'stretch'`, `gap: '12px'`, `padding: '16px 0'`

To `.ledger-row__main`: `gap: '8px'`
To `.ledger-row__title`: `whiteSpace: 'normal'`, `overflowWrap: 'break-word'`, `fontSize: '15px'`, `lineHeight: '1.35'`
To `.ledger-row__meta`: `flexDirection: 'column'`, `alignItems: 'flex-start'`, `gap: '4px'`
To `.ledger-row__actions`: `justifyContent: 'space-between'`, `width: '100%'`, `paddingTop: '8px'`, `borderTop: '1px solid var(--border-muted)'`
To action buttons: `minWidth: '44px'`, `minHeight: '44px'`

To pagination: `flexDirection: 'column'`, `alignItems: 'stretch'`, `gap: '12px'`
To pagination info: `textAlign: 'center'`
To pagination buttons: `flex: 1`, `minHeight: '44px'`

- [ ] **Step 3: Build to verify no errors**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Ledger.tsx
git commit -m "refactor(ledger): use JS-driven mobile row layout"
```

---

## Task 19: Convert Settings page to mobile layout

**Files:**
- Modify: `src/pages/Settings.tsx`

- [ ] **Step 1: Read current Settings**

Read `src/pages/Settings.tsx`.

- [ ] **Step 2: Add hook and conditional layout**

Add to imports:

```tsx
import { useBreakpoint } from '../hooks/useBreakpoint';
```

Inside the component:

```tsx
const { isMobile } = useBreakpoint();
```

Apply mobile styles:
- `.settings-section`: `padding: isMobile ? '16px' : '32px'`, `gap: isMobile ? '12px' : '16px'`
- `.color-grid`: `gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))'`
- `.color-row`: `padding: isMobile ? '12px' : 'current'`
- `.color-row__swatch`: `width: '44px'`, `height: '44px'`, `minWidth: '44px'`, `minHeight: '44px'` when `isMobile`
- `.token-row`: `flexDirection: isMobile ? 'column' : 'row'`, `alignItems: isMobile ? 'stretch' : 'center'`
- `.token-row__value`: `width: '100%'`, `fontSize: '13px'`, `wordBreak: 'break-all'` when `isMobile`
- `.token-row .btn`: `width: '100%'`, `minHeight: '44px'`, `justifyContent: 'center'` when `isMobile`
- `.terminal-block`: `padding: isMobile ? '12px 16px' : 'current'`, `fontSize: isMobile ? '12px' : 'current'`

- [ ] **Step 3: Build to verify no errors**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Settings.tsx
git commit -m "refactor(settings): use JS-driven mobile layout"
```

---

## Task 20: Remove viewport-width media queries from CSS

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Identify all viewport-width media queries**

Search for `@media` blocks with `(max-width:` or `(min-width:` in `src/index.css`. Exclude `(hover: hover)` and `(prefers-reduced-motion: reduce)`.

- [ ] **Step 2: Remove each viewport-width media query block**

For each block found, delete the entire `@media (...) { ... }` including its opening and closing braces. Be careful to only remove viewport-width queries.

- [ ] **Step 3: Build to verify no errors**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Run all tests**

Run: `npm run test -- --run`
Expected: All 169+ tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/index.css
git commit -m "refactor(css): remove all viewport-width media queries"
```

---

## Task 21: Add test helper for setBreakpoint

**Files:**
- Create: `src/test/helpers.ts`

- [ ] **Step 1: Create test helper**

Create `src/test/helpers.ts`:

```ts
export { setBreakpoint } from '../hooks/useBreakpoint';
```

(Re-export so tests can import from a stable test-utility path.)

- [ ] **Step 2: Update existing test imports to use helper path (optional)**

In `src/hooks/useBreakpoint.test.ts`, change import from:

```ts
import { useBreakpoint, setBreakpoint } from './useBreakpoint';
```

To:

```ts
import { useBreakpoint } from './useBreakpoint';
import { setBreakpoint } from '../../test/helpers';
```

- [ ] **Step 3: Run all tests**

Run: `npm run test -- --run`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/test/helpers.ts src/hooks/useBreakpoint.test.ts
git commit -m "test: add setBreakpoint test helper"
```

---

## Task 22: Final verification

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 2: Run all tests**

Run: `npm run test -- --run`
Expected: All tests pass (169+ existing + new hook tests).

- [ ] **Step 3: Verify no viewport-width media queries remain**

Run: `grep -n "@media (max-width\|@media (min-width" src/index.css`
Expected: No output (or only `(min-width: 1024px)` if kept for reference — but all should be removed).

- [ ] **Step 4: Verify capability queries remain**

Run: `grep -n "@media (hover\|@media (prefers" src/index.css`
Expected: Shows remaining `(hover: hover)` and `(prefers-reduced-motion: reduce)` blocks.

- [ ] **Step 5: Commit any final cleanup**

```bash
git add -A
git commit -m "chore: final responsive refactor cleanup" || echo "Nothing to commit"
```

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-19-responsive-refactor.md`. Two execution options:

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
