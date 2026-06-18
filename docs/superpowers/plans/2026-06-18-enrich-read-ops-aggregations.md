# Enrich CLI / MCP Read Operations with Aggregations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add first-class aggregation primitives (`--by space|combo|day|week|month` and `--period today|this-week|this-month|all`) to the `qadrant` CLI and the `qadrant-mcp` MCP server, in lockstep, mirroring the SPA's `transform.ts` group-by logic.

**Architecture:** Each surface gets a small, self-contained aggregation module (`cli/src/aggregate.ts` and `mcp-server/src/tools/aggregate.ts`) that mirrors the four date helpers from `src/lib/transform.ts`. No shared package. The CLI's `stats` command grows `--by` / `--period` / `--format` flags while keeping the no-flag default backward compatible. The MCP's `qadrant_get_stats` grows the same flags; the no-flag path keeps the legacy single-number shape. A new `qadrant_aggregate` MCP tool is added in lockstep with the new `qadrant aggregate` CLI command.

**Tech Stack:** Node 18+, TypeScript 5.6, Vitest 2.1, PocketBase REST API. No new runtime dependencies (date helpers hand-rolled, mirroring `transform.ts`).

**Spec:** `docs/superpowers/specs/2026-06-18-enrich-read-ops-aggregations-design.md`

---

## File Map

Files created and modified by this plan, with their responsibilities:

| File | Status | Responsibility |
| --- | --- | --- |
| `cli/src/aggregate.ts` | NEW | Aggregation core for the CLI: date helpers, period filter, group-by, text/JSON formatters |
| `cli/src/aggregate.test.ts` | NEW | Unit tests for `aggregate.ts` |
| `cli/src/index.ts` | EDIT | Wire `aggregate` command; extend `stats` command; widen `parseArgs` options |
| `cli/src/index.test.ts` | EDIT | Add CLI-level tests for the new commands and extended flags |
| `mcp-server/src/tools/aggregate.ts` | NEW | Aggregation core for the MCP server (mirrors `cli/src/aggregate.ts`) |
| `mcp-server/src/tools/aggregate.test.ts` | NEW | Unit tests for the MCP aggregation tool |
| `mcp-server/src/schemas.ts` | EDIT | Add `AggregateSchema`; extend `GetStatsSchema` with `by` and `period` |
| `mcp-server/src/tools/stats.ts` | EDIT | Branch on `by`: legacy path or grouped path |
| `mcp-server/src/index.ts` | EDIT | Register `qadrant_aggregate` tool |
| `mcp-server/src/index.test.ts` | EDIT | Tests for the new tool and the extended `qadrant_get_stats` |

**Date helpers, mirrored from `src/lib/transform.ts` (read-only reference — do not import):**
- `getLocalDateString(d: Date): string` — returns `YYYY-MM-DD`
- `getLocalMonthString(d: Date): string` — returns `YYYY-MM`
- `getLocalWeekMondayString(d: Date): string` — returns local Monday `YYYY-MM-DD`
- `getEntryDurationHours(entry): number` — decimal hours, `0` for active entries

---

## Phase 1: CLI Aggregation Core

### Task 1: Date helpers (CLI)

**Files:**
- Create: `cli/src/aggregate.ts`
- Create: `cli/src/aggregate.test.ts`

These four helpers are pure, side-effect-free, and follow the same semantics as `src/lib/transform.ts`. They are the foundation for everything else.

- [ ] **Step 1: Write the failing test**

Create `cli/src/aggregate.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  getLocalDateString,
  getLocalMonthString,
  getLocalWeekMondayString,
  getEntryDurationHours,
} from './aggregate.js';

describe('getLocalDateString', () => {
  it('formats a date as YYYY-MM-DD', () => {
    const d = new Date(2026, 5, 18); // June 18, 2026 (local)
    expect(getLocalDateString(d)).toBe('2026-06-18');
  });

  it('zero-pads single-digit months and days', () => {
    const d = new Date(2026, 0, 5); // Jan 5, 2026
    expect(getLocalDateString(d)).toBe('2026-01-05');
  });

  it('returns "Invalid Date" for an invalid Date', () => {
    expect(getLocalDateString(new Date('not-a-date'))).toBe('Invalid Date');
  });
});

describe('getLocalMonthString', () => {
  it('formats a month as YYYY-MM', () => {
    const d = new Date(2026, 5, 18);
    expect(getLocalMonthString(d)).toBe('2026-06');
  });

  it('zero-pads single-digit months', () => {
    const d = new Date(2026, 0, 18);
    expect(getLocalMonthString(d)).toBe('2026-01');
  });

  it('returns "Invalid Date" for an invalid Date', () => {
    expect(getLocalMonthString(new Date('not-a-date'))).toBe('Invalid Date');
  });
});

describe('getLocalWeekMondayString', () => {
  it('returns the same day for a Monday', () => {
    const monday = new Date(2026, 5, 15); // June 15, 2026 is a Monday
    expect(getLocalWeekMondayString(monday)).toBe('2026-06-15');
  });

  it('rolls back to the prior Monday for a Wednesday', () => {
    const wednesday = new Date(2026, 5, 17); // June 17, 2026
    expect(getLocalWeekMondayString(wednesday)).toBe('2026-06-15');
  });

  it('rolls back to the prior Monday for a Sunday', () => {
    const sunday = new Date(2026, 5, 21); // June 21, 2026
    expect(getLocalWeekMondayString(sunday)).toBe('2026-06-15');
  });
});

describe('getEntryDurationHours', () => {
  it('returns decimal hours for a completed entry', () => {
    expect(
      getEntryDurationHours({
        id: '1',
        space: 'W',
        specialization: '',
        start_date: '2026-06-18T10:00:00.000Z',
        completion_time: '2026-06-18T12:30:00.000Z',
        user: 'u',
      })
    ).toBeCloseTo(2.5, 5);
  });

  it('returns 0 for an active entry (no completion_time)', () => {
    expect(
      getEntryDurationHours({
        id: '1',
        space: 'W',
        specialization: '',
        start_date: '2026-06-18T10:00:00.000Z',
        completion_time: null,
        user: 'u',
      })
    ).toBe(0);
  });

  it('returns 0 for an entry with an invalid completion_time', () => {
    expect(
      getEntryDurationHours({
        id: '1',
        space: 'W',
        specialization: '',
        start_date: '2026-06-18T10:00:00.000Z',
        completion_time: 'not-a-date',
        user: 'u',
      })
    ).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cli && npx vitest run src/aggregate.test.ts`
Expected: FAIL with "Cannot find module './aggregate.js'".

- [ ] **Step 3: Implement the date helpers**

Create `cli/src/aggregate.ts`:

```typescript
export interface TimeEntry {
  id: string;
  space: string;
  specialization: string;
  start_date: string;
  completion_time: string | null;
  user: string;
}

export function getLocalDateString(d: Date): string {
  if (isNaN(d.getTime())) return 'Invalid Date';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLocalMonthString(d: Date): string {
  if (isNaN(d.getTime())) return 'Invalid Date';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getLocalWeekMondayString(d: Date): string {
  if (isNaN(d.getTime())) return 'Invalid Date';
  const dayOfWeek = d.getDay(); // 0 = Sunday, 1 = Monday, ...
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  return getLocalDateString(monday);
}

export function getEntryDurationHours(entry: TimeEntry): number {
  if (!entry.completion_time) return 0;
  const start = new Date(entry.start_date);
  const end = new Date(entry.completion_time);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  const ms = end.getTime() - start.getTime();
  return Math.max(0, ms / (1000 * 60 * 60));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd cli && npx vitest run src/aggregate.test.ts`
Expected: PASS, all 12 tests green.

- [ ] **Step 5: Commit**

```bash
cd /Users/viardant/Code/qadrant
git add cli/src/aggregate.ts cli/src/aggregate.test.ts
git commit -m "feat(cli): add date helpers for aggregation"
```

---

### Task 2: Period filter (CLI)

**Files:**
- Modify: `cli/src/aggregate.ts` — add `Period` type, `filterByPeriod`, `windowForPeriod`
- Modify: `cli/src/aggregate.test.ts` — add filter tests

- [ ] **Step 1: Write the failing test**

Append to `cli/src/aggregate.test.ts`:

```typescript
import type { TimeEntry } from './aggregate.js';
import { filterByPeriod } from './aggregate.js';

const entry = (startISO: string, completionISO: string | null = null, overrides: Partial<TimeEntry> = {}): TimeEntry => ({
  id: '1',
  space: 'W',
  specialization: '',
  start_date: startISO,
  completion_time: completionISO,
  user: 'u',
  ...overrides,
});

describe('filterByPeriod', () => {
  // Use a fixed "now" so tests are deterministic. This Monday is 2026-06-15.
  const now = new Date(2026, 5, 17, 14, 0, 0); // Wed June 17, 2026, 14:00 local

  it('keeps entries whose start_date is today for "today"', () => {
    const todayStart = new Date(2026, 5, 17, 9, 0, 0).toISOString();
    const yesterdayStart = new Date(2026, 5, 16, 9, 0, 0).toISOString();
    const result = filterByPeriod(
      [entry(todayStart), entry(yesterdayStart)],
      'today',
      now
    );
    expect(result).toHaveLength(1);
  });

  it('keeps entries whose start_date is in the current local week for "this-week"', () => {
    // Week is Mon 2026-06-15 .. Sun 2026-06-21
    const monStart = new Date(2026, 5, 15, 9, 0, 0).toISOString();
    const sunStart = new Date(2026, 5, 21, 9, 0, 0).toISOString();
    const lastSunStart = new Date(2026, 5, 14, 9, 0, 0).toISOString();
    const result = filterByPeriod(
      [entry(monStart), entry(sunStart), entry(lastSunStart)],
      'this-week',
      now
    );
    expect(result).toHaveLength(2);
  });

  it('keeps entries whose start_date is in the current month for "this-month"', () => {
    const inMonth = new Date(2026, 5, 1, 9, 0, 0).toISOString();
    const lastMonth = new Date(2026, 4, 31, 9, 0, 0).toISOString();
    const result = filterByPeriod(
      [entry(inMonth), entry(lastMonth)],
      'this-month',
      now
    );
    expect(result).toHaveLength(1);
  });

  it('keeps every entry for "all"', () => {
    const a = new Date(2024, 0, 1, 0, 0, 0).toISOString();
    const b = new Date(2025, 0, 1, 0, 0, 0).toISOString();
    const c = new Date(2026, 5, 17, 0, 0, 0).toISOString();
    const result = filterByPeriod([entry(a), entry(b), entry(c)], 'all', now);
    expect(result).toHaveLength(3);
  });

  it('drops entries with an invalid start_date', () => {
    const result = filterByPeriod(
      [entry('not-a-date'), entry(new Date(2026, 5, 17, 0, 0, 0).toISOString())],
      'all',
      now
    );
    expect(result).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cli && npx vitest run src/aggregate.test.ts`
Expected: FAIL with "filterByPeriod is not a function".

- [ ] **Step 3: Implement the period filter**

Append to `cli/src/aggregate.ts`:

```typescript
export type Period = 'today' | 'this-week' | 'this-month' | 'all';

export interface Window {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD (inclusive)
}

export function windowForPeriod(period: Period, now: Date = new Date()): Window | null {
  if (isNaN(now.getTime())) return null;
  if (period === 'all') return null;
  if (period === 'today') {
    return { start: getLocalDateString(now), end: getLocalDateString(now) };
  }
  if (period === 'this-week') {
    const mondayStr = getLocalWeekMondayString(now);
    const monday = new Date(mondayStr + 'T00:00:00');
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start: mondayStr, end: getLocalDateString(sunday) };
  }
  if (period === 'this-month') {
    const monthStr = getLocalMonthString(now);
    const year = now.getFullYear();
    const month = now.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    return {
      start: `${monthStr}-01`,
      end: `${monthStr}-${String(lastDay).padStart(2, '0')}`,
    };
  }
  return null;
}

export function filterByPeriod(
  entries: TimeEntry[],
  period: Period,
  now: Date = new Date()
): TimeEntry[] {
  if (period === 'all') {
    return entries.filter((e) => {
      const d = new Date(e.start_date);
      return !isNaN(d.getTime());
    });
  }

  const window = windowForPeriod(period, now);
  if (!window) return [];

  return entries.filter((e) => {
    const d = new Date(e.start_date);
    if (isNaN(d.getTime())) return false;
    const key = getLocalDateString(d);
    return key >= window.start && key <= window.end;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd cli && npx vitest run src/aggregate.test.ts`
Expected: PASS, all 17 tests green.

- [ ] **Step 5: Commit**

```bash
cd /Users/viardant/Code/qadrant
git add cli/src/aggregate.ts cli/src/aggregate.test.ts
git commit -m "feat(cli): add filterByPeriod with today/this-week/this-month/all windows"
```

---

### Task 3: groupBy (CLI)

**Files:**
- Modify: `cli/src/aggregate.ts` — add `GroupBy` type, `groupBy`, `comboDisplayName`
- Modify: `cli/src/aggregate.test.ts` — add groupBy tests

- [ ] **Step 1: Write the failing test**

Append to `cli/src/aggregate.test.ts`:

```typescript
import { groupBy, comboDisplayName, type GroupBy } from './aggregate.js';

const e = (space: string, specialization: string, startISO: string, completionISO: string | null = null): TimeEntry => ({
  id: '1',
  space,
  specialization,
  start_date: startISO,
  completion_time: completionISO,
  user: 'u',
});

describe('comboDisplayName', () => {
  it('joins space and specialization with " / "', () => {
    expect(comboDisplayName('Work', 'frontend')).toBe('Work / frontend');
  });
  it('returns space when specialization is empty', () => {
    expect(comboDisplayName('Work', '')).toBe('Work');
  });
  it('returns specialization when space is empty', () => {
    expect(comboDisplayName('', 'frontend')).toBe('frontend');
  });
  it('returns "Untitled" when both are empty', () => {
    expect(comboDisplayName('', '')).toBe('Untitled');
  });
});

describe('groupBy', () => {
  const sample: TimeEntry[] = [
    e('Work', 'frontend', '2026-06-15T10:00:00.000Z', '2026-06-15T11:00:00.000Z'),
    e('Work', 'frontend', '2026-06-16T10:00:00.000Z', '2026-06-16T11:30:00.000Z'),
    e('Work', 'meeting',  '2026-06-15T13:00:00.000Z', '2026-06-15T14:00:00.000Z'),
    e('Piano', '',        '2026-06-15T15:00:00.000Z', '2026-06-15T16:00:00.000Z'),
  ];

  it('groups by space, defaulting empty to "No Space"', () => {
    const result = groupBy([...sample, e('', '', '2026-06-15T10:00:00.000Z', '2026-06-15T10:30:00.000Z')], 'space');
    const keys = result.map((r) => r.key);
    expect(keys).toContain('Work');
    expect(keys).toContain('Piano');
    expect(keys).toContain('No Space');
  });

  it('groups by combo', () => {
    const result = groupBy(sample, 'combo');
    const keys = result.map((r) => r.key);
    expect(keys).toContain('Work / frontend');
    expect(keys).toContain('Work / meeting');
    expect(keys).toContain('Piano');
  });

  it('groups by local day, week, month', () => {
    const byDay = groupBy(sample, 'day').map((r) => r.key);
    expect(byDay).toContain('2026-06-15');
    expect(byDay).toContain('2026-06-16');

    const byWeek = groupBy(sample, 'week').map((r) => r.key);
    expect(byWeek).toContain('2026-06-15'); // Mon of that week

    const byMonth = groupBy(sample, 'month').map((r) => r.key);
    expect(byMonth).toContain('2026-06');
  });

  it('sums hours and counts completed entries only', () => {
    const result = groupBy(sample, 'combo');
    const frontend = result.find((r) => r.key === 'Work / frontend');
    expect(frontend).toBeDefined();
    expect(frontend!.hours).toBeCloseTo(1.5, 5);
    expect(frontend!.sessions).toBe(2);
  });

  it('excludes active (no completion_time) entries from hours and sessions', () => {
    const data: TimeEntry[] = [
      e('Work', 'frontend', '2026-06-15T10:00:00.000Z', '2026-06-15T11:00:00.000Z'),
      e('Work', 'frontend', '2026-06-15T12:00:00.000Z', null),
    ];
    const result = groupBy(data, 'combo');
    expect(result).toHaveLength(1);
    expect(result[0].hours).toBeCloseTo(1.0, 5);
    expect(result[0].sessions).toBe(1);
  });

  it('skips entries with invalid start_date', () => {
    const data: TimeEntry[] = [
      e('Work', '', 'not-a-date', '2026-06-15T11:00:00.000Z'),
      e('Work', '', '2026-06-15T10:00:00.000Z', '2026-06-15T11:00:00.000Z'),
    ];
    const result = groupBy(data, 'space');
    expect(result).toHaveLength(1);
    expect(result[0].hours).toBeCloseTo(1.0, 5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cli && npx vitest run src/aggregate.test.ts`
Expected: FAIL with "groupBy is not a function".

- [ ] **Step 3: Implement groupBy and comboDisplayName**

Append to `cli/src/aggregate.ts`:

```typescript
export type GroupBy = 'space' | 'combo' | 'day' | 'week' | 'month';

export function comboDisplayName(space: string, specialization: string): string {
  if (!specialization) return space || 'Untitled';
  if (!space) return specialization;
  return `${space} / ${specialization}`;
}

export interface AggregateRow {
  key: string;
  hours: number;
  sessions: number;
}

function groupKey(entry: TimeEntry, by: GroupBy): string | null {
  const d = new Date(entry.start_date);
  if (isNaN(d.getTime())) return null;
  const space = entry.space || 'No Space';
  switch (by) {
    case 'space':
      return space;
    case 'combo':
      return comboDisplayName(entry.space || '', entry.specialization || '');
    case 'day':
      return getLocalDateString(d);
    case 'week':
      return getLocalWeekMondayString(d);
    case 'month':
      return getLocalMonthString(d);
  }
}

export function groupBy(entries: TimeEntry[], by: GroupBy): AggregateRow[] {
  const buckets = new Map<string, { hours: number; sessions: number }>();
  for (const entry of entries) {
    const key = groupKey(entry, by);
    if (key === null) continue;
    const hours = getEntryDurationHours(entry);
    const existing = buckets.get(key) ?? { hours: 0, sessions: 0 };
    existing.hours += hours;
    if (entry.completion_time) existing.sessions += 1;
    buckets.set(key, existing);
  }
  const rows: AggregateRow[] = [];
  for (const [key, agg] of buckets) {
    rows.push({
      key,
      hours: Number(agg.hours.toFixed(2)),
      sessions: agg.sessions,
    });
  }
  return rows;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd cli && npx vitest run src/aggregate.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
cd /Users/viardant/Code/qadrant
git add cli/src/aggregate.ts cli/src/aggregate.test.ts
git commit -m "feat(cli): add groupBy for space/combo/day/week/month"
```

---

### Task 4: aggregateBy orchestrator (CLI)

**Files:**
- Modify: `cli/src/aggregate.ts` — add `aggregateBy` and `AggregateResult` interface
- Modify: `cli/src/aggregate.test.ts` — add orchestrator test

- [ ] **Step 1: Write the failing test**

Append to `cli/src/aggregate.test.ts`:

```typescript
import { aggregateBy } from './aggregate.js';

describe('aggregateBy', () => {
  const sample: TimeEntry[] = [
    e('Work', 'frontend', '2026-06-15T10:00:00.000Z', '2026-06-15T11:00:00.000Z'), // 1h
    e('Work', 'frontend', '2026-06-16T10:00:00.000Z', '2026-06-16T11:30:00.000Z'), // 1.5h
    e('Piano', '',        '2026-06-15T15:00:00.000Z', '2026-06-15T16:00:00.000Z'), // 1h
  ];
  const now = new Date(2026, 5, 17, 14, 0, 0);

  it('produces a sorted result (hours desc, key asc)', () => {
    const result = aggregateBy(sample, { by: 'combo', period: 'all' }, now);
    expect(result.by).toBe('combo');
    expect(result.period).toBe('all');
    expect(result.window).toBeNull();
    expect(result.rows[0].key).toBe('Work / frontend'); // 2.5h > 1h
    expect(result.rows[0].hours).toBeCloseTo(2.5, 5);
  });

  it('applies share fractions that sum to <= 1', () => {
    const result = aggregateBy(sample, { by: 'space', period: 'all' }, now);
    const totalShare = result.rows.reduce((sum, r) => sum + r.share, 0);
    expect(totalShare).toBeCloseTo(1.0, 5);
  });

  it('returns a window for "this-month"', () => {
    const result = aggregateBy(sample, { by: 'day', period: 'this-month' }, now);
    expect(result.window).not.toBeNull();
    expect(result.window!.start).toBe('2026-06-01');
    expect(result.window!.end).toBe('2026-06-30');
  });

  it('returns empty rows when nothing matches the period', () => {
    const result = aggregateBy([], { by: 'space', period: 'today' }, now);
    expect(result.rows).toEqual([]);
    expect(result.total).toEqual({ hours: 0, sessions: 0 });
  });

  it('total hours equal the sum of row hours', () => {
    const result = aggregateBy(sample, { by: 'space', period: 'all' }, now);
    const summed = result.rows.reduce((s, r) => s + r.hours, 0);
    expect(result.total.hours).toBeCloseTo(summed, 5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cli && npx vitest run src/aggregate.test.ts`
Expected: FAIL with "aggregateBy is not a function".

- [ ] **Step 3: Implement aggregateBy**

Append to `cli/src/aggregate.ts`:

```typescript
export interface AggregateResult {
  by: GroupBy;
  period: Period;
  window: Window | null;
  rows: Array<AggregateRow & { share: number }>;
  total: { hours: number; sessions: number };
}

export interface AggregateOptions {
  by: GroupBy;
  period?: Period;
}

export function aggregateBy(
  entries: TimeEntry[],
  options: AggregateOptions,
  now: Date = new Date()
): AggregateResult {
  const period: Period = options.period ?? 'all';
  const filtered = filterByPeriod(entries, period, now);
  const rows = groupBy(filtered, options.by);
  const totalHours = rows.reduce((s, r) => s + r.hours, 0);
  const totalSessions = rows.reduce((s, r) => s + r.sessions, 0);
  const enriched = rows.map((r) => ({
    ...r,
    share: totalHours > 0 ? Number((r.hours / totalHours).toFixed(4)) : 0,
  }));
  enriched.sort((a, b) => b.hours - a.hours || a.key.localeCompare(b.key));
  return {
    by: options.by,
    period,
    window: windowForPeriod(period, now),
    rows: enriched,
    total: {
      hours: Number(totalHours.toFixed(2)),
      sessions: totalSessions,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd cli && npx vitest run src/aggregate.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
cd /Users/viardant/Code/qadrant
git add cli/src/aggregate.ts cli/src/aggregate.test.ts
git commit -m "feat(cli): add aggregateBy orchestrator"
```

---

### Task 5: formatAggregateText (CLI)

**Files:**
- Modify: `cli/src/aggregate.ts` — add `formatAggregateText`
- Modify: `cli/src/aggregate.test.ts` — add formatter test

- [ ] **Step 1: Write the failing test**

Append to `cli/src/aggregate.test.ts`:

```typescript
import { formatAggregateText, type AggregateResult } from './aggregate.js';

const fixture = (): AggregateResult => ({
  by: 'space',
  period: 'this-month',
  window: { start: '2026-06-01', end: '2026-06-30' },
  rows: [
    { key: 'Work',   hours: 12.34, sessions: 8, share: 0.6421 },
    { key: 'Piano',  hours:  4.21, sessions: 5, share: 0.2193 },
    { key: 'qadrant', hours: 2.65, sessions: 3, share: 0.1386 },
  ],
  total: { hours: 19.20, sessions: 16 },
});

describe('formatAggregateText', () => {
  it('includes DIMENSION / PERIOD / WINDOW header', () => {
    const out = formatAggregateText(fixture());
    expect(out).toContain('DIMENSION: SPACE');
    expect(out).toContain('PERIOD:    THIS_MONTH');
    expect(out).toContain('WINDOW:    2026-06-01..2026-06-30');
  });

  it('renders rows in the table with hours, sessions, share%', () => {
    const out = formatAggregateText(fixture());
    expect(out).toContain('Work');
    expect(out).toContain('12.34');
    expect(out).toContain('64.2%');
  });

  it('renders a TOTAL row at the bottom', () => {
    const out = formatAggregateText(fixture());
    expect(out).toMatch(/TOTAL\s+19\.20\s+16\s+100\.0%/);
  });

  it('renders a NO_DATA row when there are no entries', () => {
    const empty: AggregateResult = { ...fixture(), rows: [], total: { hours: 0, sessions: 0 } };
    const out = formatAggregateText(empty);
    expect(out).toContain('NO_DATA');
  });

  it('omits WINDOW when period is "all"', () => {
    const all: AggregateResult = { ...fixture(), period: 'all', window: null };
    const out = formatAggregateText(all);
    expect(out).not.toContain('WINDOW:');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cli && npx vitest run src/aggregate.test.ts`
Expected: FAIL with "formatAggregateText is not a function".

- [ ] **Step 3: Implement formatAggregateText**

Append to `cli/src/aggregate.ts`:

```typescript
const MAX_KEY_WIDTH = 32;

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

function pad(s: string, n: number): string {
  if (s.length >= n) return s;
  return s + ' '.repeat(n - s.length);
}

function padLeft(s: string, n: number): string {
  if (s.length >= n) return s;
  return ' '.repeat(n - s.length) + s;
}

export function formatAggregateText(result: AggregateResult): string {
  const dimensionLabel = result.by.toUpperCase();
  const periodLabel = result.period.toUpperCase();
  const lines: string[] = [];
  lines.push(`DIMENSION: ${dimensionLabel}`);
  lines.push(`PERIOD:    ${periodLabel}`);
  if (result.window) {
    lines.push(`WINDOW:    ${result.window.start}..${result.window.end}`);
  }
  lines.push('');

  if (result.rows.length === 0) {
    lines.push('NO_DATA');
    return lines.join('\n');
  }

  const keyWidth = Math.min(
    MAX_KEY_WIDTH,
    Math.max(3, ...result.rows.map((r) => truncate(r.key, MAX_KEY_WIDTH).length))
  );
  const header =
    pad('KEY', keyWidth) +
    '  ' +
    padLeft('HOURS', 7) +
    '  ' +
    padLeft('SESSIONS', 8) +
    '  ' +
    padLeft('SHARE', 7);
  const rule = '-'.repeat(header.length);
  lines.push(rule);
  lines.push(header);
  lines.push(rule);
  for (const row of result.rows) {
    lines.push(
      pad(truncate(row.key, MAX_KEY_WIDTH), keyWidth) +
        '  ' +
        padLeft(row.hours.toFixed(2), 7) +
        '  ' +
        padLeft(String(row.sessions), 8) +
        '  ' +
        padLeft((row.share * 100).toFixed(1) + '%', 7)
    );
  }
  lines.push(rule);
  lines.push(
    pad('TOTAL', keyWidth) +
      '  ' +
      padLeft(result.total.hours.toFixed(2), 7) +
      '  ' +
      padLeft(String(result.total.sessions), 8) +
      '  ' +
      padLeft('100.0%', 7)
  );
  return lines.join('\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd cli && npx vitest run src/aggregate.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
cd /Users/viardant/Code/qadrant
git add cli/src/aggregate.ts cli/src/aggregate.test.ts
git commit -m "feat(cli): add formatAggregateText renderer"
```

---

### Task 6: formatAggregateJson (CLI)

**Files:**
- Modify: `cli/src/aggregate.ts` — add `formatAggregateJson`
- Modify: `cli/src/aggregate.test.ts` — add formatter test

- [ ] **Step 1: Write the failing test**

Append to `cli/src/aggregate.test.ts`:

```typescript
import { formatAggregateJson } from './aggregate.js';

describe('formatAggregateJson', () => {
  it('serialises to the documented JSON envelope', () => {
    const json = formatAggregateJson(fixture());
    const parsed = JSON.parse(json);
    expect(parsed.by).toBe('space');
    expect(parsed.period).toBe('this-month');
    expect(parsed.window).toEqual({ start: '2026-06-01', end: '2026-06-30' });
    expect(parsed.rows[0]).toEqual({ key: 'Work', hours: 12.34, sessions: 8, share: 0.6421 });
    expect(parsed.total).toEqual({ hours: 19.20, sessions: 16 });
  });

  it('emits null window when period is "all"', () => {
    const all = { ...fixture(), period: 'all' as const, window: null };
    const parsed = JSON.parse(formatAggregateJson(all));
    expect(parsed.window).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cli && npx vitest run src/aggregate.test.ts`
Expected: FAIL with "formatAggregateJson is not a function".

- [ ] **Step 3: Implement formatAggregateJson**

Append to `cli/src/aggregate.ts`:

```typescript
export function formatAggregateJson(result: AggregateResult): string {
  return JSON.stringify(result, null, 2);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd cli && npx vitest run src/aggregate.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
cd /Users/viardant/Code/qadrant
git add cli/src/aggregate.ts cli/src/aggregate.test.ts
git commit -m "feat(cli): add formatAggregateJson"
```

---

## Phase 2: CLI Command Wire-up

### Task 7: Extend parseArgs

**Files:**
- Modify: `cli/src/index.ts` — widen `options` type to include `by`, `period`, `format`
- Modify: `cli/src/index.test.ts` — add tests for the new flags

- [ ] **Step 1: Write the failing test**

Append to `cli/src/index.test.ts`:

```typescript
describe('CLI Argument Parsing - aggregation flags', () => {
  it('parses --by, --period, --format together', () => {
    const parsed = parseArgs([
      'node', 'qadrant', 'aggregate',
      '--by', 'space',
      '--period', 'this-month',
      '--format', 'json',
    ]);
    expect(parsed.command).toBe('aggregate');
    expect(parsed.options.by).toBe('space');
    expect(parsed.options.period).toBe('this-month');
    expect(parsed.options.format).toBe('json');
  });

  it('parses --by and --format on stats', () => {
    const parsed = parseArgs([
      'node', 'qadrant', 'stats',
      '--by', 'day',
      '--period', 'today',
      '--format', 'text',
    ]);
    expect(parsed.command).toBe('stats');
    expect(parsed.options.by).toBe('day');
    expect(parsed.options.period).toBe('today');
    expect(parsed.options.format).toBe('text');
  });

  it('leaves new options undefined when omitted', () => {
    const parsed = parseArgs(['node', 'qadrant', 'list', '--limit', '5']);
    expect(parsed.options.by).toBeUndefined();
    expect(parsed.options.period).toBeUndefined();
    expect(parsed.options.format).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cli && npx vitest run src/index.test.ts`
Expected: FAIL with "expected undefined to be 'space'" (or similar).

- [ ] **Step 3: Widen parseArgs**

In `cli/src/index.ts`, replace the `parseArgs` function:

```typescript
export function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  if (args.length === 0) {
    return { command: null, args: [], options: {} };
  }

  const command = args[0] as 'login' | 'start' | 'stop' | 'status' | 'list' | 'stats' | 'aggregate' | null;
  const remainingArgs: string[] = [];
  const options: {
    url?: string;
    space?: string;
    sub?: string;
    limit?: number;
    by?: string;
    period?: string;
    format?: string;
  } = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--url' && i + 1 < args.length) {
      options.url = args[++i];
    } else if (arg === '--space' && i + 1 < args.length) {
      options.space = args[++i];
    } else if (arg === '--sub' && i + 1 < args.length) {
      options.sub = args[++i];
    } else if (arg === '--limit' && i + 1 < args.length) {
      options.limit = parseInt(args[++i], 10);
    } else if (arg === '--by' && i + 1 < args.length) {
      options.by = args[++i];
    } else if (arg === '--period' && i + 1 < args.length) {
      options.period = args[++i];
    } else if (arg === '--format' && i + 1 < args.length) {
      options.format = args[++i];
    } else {
      remainingArgs.push(arg);
    }
  }

  return {
    command,
    args: remainingArgs,
    options
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd cli && npx vitest run src/index.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
cd /Users/viardant/Code/qadrant
git add cli/src/index.ts cli/src/index.test.ts
git commit -m "feat(cli): extend parseArgs with --by, --period, --format"
```

---

### Task 8: aggregate command branch

**Files:**
- Modify: `cli/src/index.ts` — add the `aggregate` command branch in `main()` and extend `printHelp()`

- [ ] **Step 1: Read the current main() to know the insertion point**

The aggregate branch should sit just before the `printHelp()` call at the end of `main()`. We also need a `fetchAggregateEntries` helper and the validation block.

- [ ] **Step 2: Add `aggregate` branch to main()**

In `cli/src/index.ts`, add the following code **just before the `printHelp();` line at the end of `main()`**:

```typescript
  if (parsed.command === 'aggregate') {
    const by = parsed.options.by;
    const period = parsed.options.period;
    const format = parsed.options.format ?? 'text';

    if (!by) {
      console.error('ERROR: --by is required for aggregate');
      process.exit(1);
      return;
    }
    if (!['space', 'combo', 'day', 'week', 'month'].includes(by)) {
      console.error('ERROR: --by must be one of space|combo|day|week|month');
      process.exit(1);
      return;
    }
    if (period !== undefined && !['today', 'this-week', 'this-month', 'all'].includes(period)) {
      console.error('ERROR: --period must be one of today|this-week|this-month|all');
      process.exit(1);
      return;
    }
    if (!['text', 'json'].includes(format)) {
      console.error('ERROR: --format must be text|json');
      process.exit(1);
      return;
    }

    try {
      const filter = `user='${config.user_id}' && completion_time!=""`;
      const url = `/api/collections/time_entries/records?filter=${encodeURIComponent(filter)}&perPage=100000&sort=-start_date`;
      const response = await apiCall(config.pb_url, config.auth_token, url) as { items?: Array<{ id: string; space: string; specialization?: string; start_date: string; completion_time?: string }> };
      const rawEntries = response.items || [];
      const entries = rawEntries
        .filter((e) => e.completion_time)
        .map((e) => ({
          id: e.id,
          space: e.space || '',
          specialization: e.specialization || '',
          start_date: e.start_date,
          completion_time: e.completion_time || null,
          user: config.user_id,
        }));
      const result = aggregateBy(entries, { by: by as GroupBy, period: period as Period | undefined });
      if (format === 'json') {
        console.log(formatAggregateJson(result));
      } else {
        console.log(formatAggregateText(result));
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${errMsg}`);
      process.exit(1);
      return;
    }
    return;
  }
```

- [ ] **Step 3: Add the import to the top of `cli/src/index.ts`**

Add the following import after the existing imports:

```typescript
import { aggregateBy, formatAggregateText, formatAggregateJson, type GroupBy, type Period } from './aggregate.js';
```

- [ ] **Step 4: Update `printHelp()` to mention the new command**

Replace `printHelp()` in `cli/src/index.ts` with:

```typescript
function printHelp() {
  console.log(`
qadrant - Qadrant Time Tracker CLI

Usage:
  qadrant login <token> [--url <pocketbase_url>]
  qadrant start "<space>" [--sub <specialization>]
  qadrant stop
  qadrant status
  qadrant list [--limit <n>]
  qadrant stats [--by <space|combo|day|week|month>] [--period <today|this-week|this-month|all>] [--format <text|json>]
  qadrant aggregate --by <space|combo|day|week|month> [--period <today|this-week|this-month|all>] [--format <text|json>]
`);
}
```

- [ ] **Step 5: Type-check the file**

Run: `cd cli && npx tsc --noEmit`
Expected: 0 errors. If the project doesn't have a `tsc` script, use `npx tsc --noEmit -p tsconfig.json`.

- [ ] **Step 6: Run the existing CLI tests to confirm no regression**

Run: `cd cli && npx vitest run`
Expected: all pre-existing tests still pass.

- [ ] **Step 7: Commit**

```bash
cd /Users/viardant/Code/qadrant
git add cli/src/index.ts
git commit -m "feat(cli): add aggregate command branch"
```

---

### Task 9: Extend stats command with by/period/format

**Files:**
- Modify: `cli/src/index.ts` — replace the `stats` command branch

- [ ] **Step 1: Read the existing `stats` branch**

It's the `if (parsed.command === 'stats') { ... }` block near the end of `main()`. We are going to keep the no-flag path identical and add a grouped path when `--by` is supplied.

- [ ] **Step 2: Replace the stats branch**

Replace the entire `if (parsed.command === 'stats')` block in `cli/src/index.ts` with:

```typescript
  if (parsed.command === 'stats') {
    const by = parsed.options.by;
    const period = parsed.options.period;
    const format = parsed.options.format ?? 'text';

    if (by !== undefined && !['space', 'combo', 'day', 'week', 'month'].includes(by)) {
      console.error('ERROR: --by must be one of space|combo|day|week|month');
      process.exit(1);
      return;
    }
    if (period !== undefined && !['today', 'this-week', 'this-month', 'all'].includes(period)) {
      console.error('ERROR: --period must be one of today|this-week|this-month|all');
      process.exit(1);
      return;
    }
    if (!['text', 'json'].includes(format)) {
      console.error('ERROR: --format must be text|json');
      process.exit(1);
      return;
    }

    try {
      const filter = `user='${config.user_id}' && completion_time!=""`;
      const url = `/api/collections/time_entries/records?filter=${encodeURIComponent(filter)}&perPage=100000`;
      const response = await apiCall(config.pb_url, config.auth_token, url) as { items?: Array<{ id: string; space: string; specialization?: string; start_date: string; completion_time?: string }> };
      const rawEntries = response.items || [];
      const entries = rawEntries
        .filter((e) => e.completion_time)
        .map((e) => ({
          id: e.id,
          space: e.space || '',
          specialization: e.specialization || '',
          start_date: e.start_date,
          completion_time: e.completion_time || null,
          user: config.user_id,
        }));

      if (by) {
        const result = aggregateBy(entries, { by: by as GroupBy, period: period as Period | undefined });
        if (format === 'json') {
          console.log(formatAggregateJson(result));
        } else {
          console.log(formatAggregateText(result));
        }
        return;
      }

      // Legacy no-by path: single total number, unchanged.
      let totalMs = 0;
      for (const entry of entries) {
        const start = new Date(entry.start_date).getTime();
        const end = entry.completion_time ? new Date(entry.completion_time).getTime() : start;
        totalMs += Math.max(0, end - start);
      }
      const totalHours = totalMs / (1000 * 60 * 60);
      console.log(`TOTAL_TRACKED_HOURS: ${totalHours.toFixed(2)}`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${errMsg}`);
      process.exit(1);
      return;
    }
    return;
  }
```

- [ ] **Step 3: Type-check**

Run: `cd cli && npx tsc --noEmit -p tsconfig.json`
Expected: 0 errors.

- [ ] **Step 4: Run the full test suite**

Run: `cd cli && npx vitest run`
Expected: all tests pass.

- [ ] **Step 5: Build the CLI**

Run: `cd cli && npm run build`
Expected: build succeeds, no TS errors.

- [ ] **Step 6: Smoke-test the binary**

Run: `cd cli && node dist/index.js stats`
Expected: prints the legacy line `TOTAL_TRACKED_HOURS: 0.00` (no config means the command exits 1 with "Not authenticated." — that's the correct behavior, confirming the no-by path still routes through the auth gate). If you have a real config, you should see the same `TOTAL_TRACKED_HOURS: …` line you saw before this plan.

- [ ] **Step 7: Commit**

```bash
cd /Users/viardant/Code/qadrant
git add cli/src/index.ts
git commit -m "feat(cli): extend stats with --by, --period, --format (legacy path unchanged)"
```

---

## Phase 3: MCP Server Mirror

### Task 10: Aggregation core in MCP (helpers + filter + group + orchestrator)

**Files:**
- Create: `mcp-server/src/tools/aggregate.ts`
- Create: `mcp-server/src/tools/aggregate.test.ts`

The MCP's aggregation module mirrors the CLI's `aggregate.ts` but uses the MCP's `TimeEntryRecord` shape. We re-export the same JSON envelope so consumers can write the same parser for either surface.

- [ ] **Step 1: Write the failing test**

Create `mcp-server/src/tools/aggregate.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  getLocalDateString,
  getLocalMonthString,
  getLocalWeekMondayString,
  getEntryDurationHours,
  filterByPeriod,
  groupBy,
  aggregateBy,
  comboDisplayName,
  formatAggregateText,
  formatAggregateJson,
  type TimeEntryRecordForAgg,
  type GroupBy,
  type Period,
} from './aggregate.js';

const entry = (overrides: Partial<TimeEntryRecordForAgg> = {}): TimeEntryRecordForAgg => ({
  id: '1',
  space: 'W',
  specialization: '',
  start_date: '2026-06-18T10:00:00.000Z',
  completion_time: '2026-06-18T11:00:00.000Z',
  ...overrides,
});

describe('MCP aggregate: date helpers', () => {
  it('getLocalDateString returns YYYY-MM-DD', () => {
    expect(getLocalDateString(new Date(2026, 5, 18))).toBe('2026-06-18');
  });
  it('getLocalMonthString returns YYYY-MM', () => {
    expect(getLocalMonthString(new Date(2026, 5, 18))).toBe('2026-06');
  });
  it('getLocalWeekMondayString rolls back to Monday', () => {
    expect(getLocalWeekMondayString(new Date(2026, 5, 17))).toBe('2026-06-15');
  });
  it('getEntryDurationHours returns decimal hours for a completed entry', () => {
    expect(
      getEntryDurationHours(
        entry({ start_date: '2026-06-18T10:00:00.000Z', completion_time: '2026-06-18T12:30:00.000Z' })
      )
    ).toBeCloseTo(2.5, 5);
  });
  it('getEntryDurationHours returns 0 for an active entry', () => {
    expect(getEntryDurationHours(entry({ completion_time: undefined }))).toBe(0);
  });
});

describe('MCP aggregate: filterByPeriod', () => {
  const now = new Date(2026, 5, 17, 14, 0, 0);
  it('filters today / this-week / this-month / all', () => {
    const today = entry({ start_date: new Date(2026, 5, 17, 9, 0, 0).toISOString() });
    const lastMonth = entry({ start_date: new Date(2026, 4, 30, 9, 0, 0).toISOString() });
    const longAgo = entry({ start_date: new Date(2024, 0, 1, 9, 0, 0).toISOString() });
    expect(filterByPeriod([today, lastMonth, longAgo], 'today', now)).toHaveLength(1);
    expect(filterByPeriod([today, lastMonth, longAgo], 'this-week', now)).toHaveLength(1);
    expect(filterByPeriod([today, lastMonth, longAgo], 'this-month', now)).toHaveLength(1);
    expect(filterByPeriod([today, lastMonth, longAgo], 'all', now)).toHaveLength(3);
  });
});

describe('MCP aggregate: groupBy + aggregateBy', () => {
  const sample: TimeEntryRecordForAgg[] = [
    entry({ id: '1', space: 'Work', specialization: 'frontend', start_date: '2026-06-15T10:00:00.000Z', completion_time: '2026-06-15T11:00:00.000Z' }),
    entry({ id: '2', space: 'Work', specialization: 'frontend', start_date: '2026-06-16T10:00:00.000Z', completion_time: '2026-06-16T11:30:00.000Z' }),
    entry({ id: '3', space: 'Work', specialization: 'meeting', start_date: '2026-06-15T13:00:00.000Z', completion_time: '2026-06-15T14:00:00.000Z' }),
    entry({ id: '4', space: 'Piano', specialization: '', start_date: '2026-06-15T15:00:00.000Z', completion_time: '2026-06-15T16:00:00.000Z' }),
  ];
  const now = new Date(2026, 5, 17, 14, 0, 0);

  it('comboDisplayName joins space + specialization', () => {
    expect(comboDisplayName('Work', 'frontend')).toBe('Work / frontend');
    expect(comboDisplayName('Work', '')).toBe('Work');
    expect(comboDisplayName('', '')).toBe('Untitled');
  });

  it('groupBy + aggregateBy for every GroupBy value', () => {
    const bys: GroupBy[] = ['space', 'combo', 'day', 'week', 'month'];
    for (const by of bys) {
      const r = aggregateBy(sample, { by, period: 'all' }, now);
      expect(r.rows.length).toBeGreaterThan(0);
      expect(r.total.hours).toBeGreaterThan(0);
    }
  });

  it('aggregateBy returns a window for this-month', () => {
    const r = aggregateBy(sample, { by: 'day', period: 'this-month' }, now);
    expect(r.window).toEqual({ start: '2026-06-01', end: '2026-06-30' });
  });

  it('aggregateBy returns rows sorted by hours desc', () => {
    const r = aggregateBy(sample, { by: 'combo', period: 'all' }, now);
    expect(r.rows[0].key).toBe('Work / frontend');
  });
});

describe('MCP aggregate: formatters', () => {
  it('formatAggregateJson parses to the documented envelope', () => {
    const r = aggregateBy(
      [
        entry({ space: 'Work', start_date: '2026-06-15T10:00:00.000Z', completion_time: '2026-06-15T12:00:00.000Z' }),
      ],
      { by: 'space', period: 'all' },
      new Date(2026, 5, 17)
    );
    const parsed = JSON.parse(formatAggregateJson(r));
    expect(parsed.by).toBe('space');
    expect(parsed.rows[0].key).toBe('Work');
  });

  it('formatAggregateText includes DIMENSION header', () => {
    const r = aggregateBy(
      [
        entry({ space: 'Work', start_date: '2026-06-15T10:00:00.000Z', completion_time: '2026-06-15T12:00:00.000Z' }),
      ],
      { by: 'space', period: 'all' },
      new Date(2026, 5, 17)
    );
    expect(formatAggregateText(r)).toContain('DIMENSION: SPACE');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mcp-server && npx vitest run src/tools/aggregate.test.ts`
Expected: FAIL with "Cannot find module './aggregate.js'".

- [ ] **Step 3: Implement the MCP aggregation module**

Create `mcp-server/src/tools/aggregate.ts`:

```typescript
export interface TimeEntryRecordForAgg {
  id: string;
  space: string;
  specialization: string;
  start_date: string;
  completion_time: string | undefined;
}

export type GroupBy = 'space' | 'combo' | 'day' | 'week' | 'month';
export type Period = 'today' | 'this-week' | 'this-month' | 'all';

export interface Window {
  start: string;
  end: string;
}

export interface AggregateRow {
  key: string;
  hours: number;
  sessions: number;
  share: number;
}

export interface AggregateResult {
  by: GroupBy;
  period: Period;
  window: Window | null;
  rows: AggregateRow[];
  total: { hours: number; sessions: number };
}

export interface AggregateOptions {
  by: GroupBy;
  period?: Period;
}

export function getLocalDateString(d: Date): string {
  if (isNaN(d.getTime())) return 'Invalid Date';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLocalMonthString(d: Date): string {
  if (isNaN(d.getTime())) return 'Invalid Date';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getLocalWeekMondayString(d: Date): string {
  if (isNaN(d.getTime())) return 'Invalid Date';
  const dayOfWeek = d.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  return getLocalDateString(monday);
}

export function getEntryDurationHours(entry: TimeEntryRecordForAgg): number {
  if (!entry.completion_time) return 0;
  const start = new Date(entry.start_date);
  const end = new Date(entry.completion_time);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  const ms = end.getTime() - start.getTime();
  return Math.max(0, ms / (1000 * 60 * 60));
}

export function windowForPeriod(period: Period, now: Date = new Date()): Window | null {
  if (isNaN(now.getTime())) return null;
  if (period === 'all') return null;
  if (period === 'today') {
    return { start: getLocalDateString(now), end: getLocalDateString(now) };
  }
  if (period === 'this-week') {
    const mondayStr = getLocalWeekMondayString(now);
    const monday = new Date(mondayStr + 'T00:00:00');
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start: mondayStr, end: getLocalDateString(sunday) };
  }
  if (period === 'this-month') {
    const monthStr = getLocalMonthString(now);
    const year = now.getFullYear();
    const month = now.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    return {
      start: `${monthStr}-01`,
      end: `${monthStr}-${String(lastDay).padStart(2, '0')}`,
    };
  }
  return null;
}

export function filterByPeriod(
  entries: TimeEntryRecordForAgg[],
  period: Period,
  now: Date = new Date()
): TimeEntryRecordForAgg[] {
  if (period === 'all') {
    return entries.filter((e) => !isNaN(new Date(e.start_date).getTime()));
  }
  const window = windowForPeriod(period, now);
  if (!window) return [];
  return entries.filter((e) => {
    const d = new Date(e.start_date);
    if (isNaN(d.getTime())) return false;
    const key = getLocalDateString(d);
    return key >= window.start && key <= window.end;
  });
}

export function comboDisplayName(space: string, specialization: string): string {
  if (!specialization) return space || 'Untitled';
  if (!space) return specialization;
  return `${space} / ${specialization}`;
}

function groupKeyOf(entry: TimeEntryRecordForAgg, by: GroupBy): string | null {
  const d = new Date(entry.start_date);
  if (isNaN(d.getTime())) return null;
  const space = entry.space || 'No Space';
  switch (by) {
    case 'space':
      return space;
    case 'combo':
      return comboDisplayName(entry.space || '', entry.specialization || '');
    case 'day':
      return getLocalDateString(d);
    case 'week':
      return getLocalWeekMondayString(d);
    case 'month':
      return getLocalMonthString(d);
  }
}

export function groupBy(
  entries: TimeEntryRecordForAgg[],
  by: GroupBy
): Array<{ key: string; hours: number; sessions: number }> {
  const buckets = new Map<string, { hours: number; sessions: number }>();
  for (const entry of entries) {
    const key = groupKeyOf(entry, by);
    if (key === null) continue;
    const hours = getEntryDurationHours(entry);
    const existing = buckets.get(key) ?? { hours: 0, sessions: 0 };
    existing.hours += hours;
    if (entry.completion_time) existing.sessions += 1;
    buckets.set(key, existing);
  }
  const rows: Array<{ key: string; hours: number; sessions: number }> = [];
  for (const [key, agg] of buckets) {
    rows.push({ key, hours: Number(agg.hours.toFixed(2)), sessions: agg.sessions });
  }
  return rows;
}

export function aggregateBy(
  entries: TimeEntryRecordForAgg[],
  options: AggregateOptions,
  now: Date = new Date()
): AggregateResult {
  const period: Period = options.period ?? 'all';
  const filtered = filterByPeriod(entries, period, now);
  const rows = groupBy(filtered, options.by);
  const totalHours = rows.reduce((s, r) => s + r.hours, 0);
  const totalSessions = rows.reduce((s, r) => s + r.sessions, 0);
  const enriched: AggregateRow[] = rows.map((r) => ({
    ...r,
    share: totalHours > 0 ? Number((r.hours / totalHours).toFixed(4)) : 0,
  }));
  enriched.sort((a, b) => b.hours - a.hours || a.key.localeCompare(b.key));
  return {
    by: options.by,
    period,
    window: windowForPeriod(period, now),
    rows: enriched,
    total: { hours: Number(totalHours.toFixed(2)), sessions: totalSessions },
  };
}

const MAX_KEY_WIDTH = 32;

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

function padLeft(s: string, n: number): string {
  return s.length >= n ? s : ' '.repeat(n - s.length) + s;
}

export function formatAggregateText(result: AggregateResult): string {
  const lines: string[] = [];
  lines.push(`DIMENSION: ${result.by.toUpperCase()}`);
  lines.push(`PERIOD:    ${result.period.toUpperCase()}`);
  if (result.window) lines.push(`WINDOW:    ${result.window.start}..${result.window.end}`);
  lines.push('');
  if (result.rows.length === 0) {
    lines.push('NO_DATA');
    return lines.join('\n');
  }
  const keyWidth = Math.min(
    MAX_KEY_WIDTH,
    Math.max(3, ...result.rows.map((r) => truncate(r.key, MAX_KEY_WIDTH).length))
  );
  const header =
    pad('KEY', keyWidth) +
    '  ' +
    padLeft('HOURS', 7) +
    '  ' +
    padLeft('SESSIONS', 8) +
    '  ' +
    padLeft('SHARE', 7);
  const rule = '-'.repeat(header.length);
  lines.push(rule);
  lines.push(header);
  lines.push(rule);
  for (const row of result.rows) {
    lines.push(
      pad(truncate(row.key, MAX_KEY_WIDTH), keyWidth) +
        '  ' +
        padLeft(row.hours.toFixed(2), 7) +
        '  ' +
        padLeft(String(row.sessions), 8) +
        '  ' +
        padLeft((row.share * 100).toFixed(1) + '%', 7)
    );
  }
  lines.push(rule);
  lines.push(
    pad('TOTAL', keyWidth) +
      '  ' +
      padLeft(result.total.hours.toFixed(2), 7) +
      '  ' +
      padLeft(String(result.total.sessions), 8) +
      '  ' +
      padLeft('100.0%', 7)
  );
  return lines.join('\n');
}

export function formatAggregateJson(result: AggregateResult): string {
  return JSON.stringify(result, null, 2);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mcp-server && npx vitest run src/tools/aggregate.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
cd /Users/viardant/Code/qadrant
git add mcp-server/src/tools/aggregate.ts mcp-server/src/tools/aggregate.test.ts
git commit -m "feat(mcp): add aggregation core (helpers, filter, group, orchestrator, formatters)"
```

---

### Task 11: AggregateSchema + extend GetStatsSchema

**Files:**
- Modify: `mcp-server/src/schemas.ts` — add `AggregateSchema`, extend `GetStatsSchema`

- [ ] **Step 1: Read the current schemas file**

The current file is at `mcp-server/src/schemas.ts` (see the spec for the current shape). The new schema is added next to `GetStatsSchema`, and `GetStatsSchema` gets two new optional fields.

- [ ] **Step 2: Replace the schemas file**

Overwrite `mcp-server/src/schemas.ts` with:

```typescript
import { z } from 'zod';
import { ResponseFormat } from './types.js';
import { MAX_LIST_LIMIT } from './constants.js';

export const StartTimerSchema = z.object({
  space: z
    .string()
    .min(1, 'Space name is required')
    .max(100, 'Space name must not exceed 100 characters')
    .describe('The space category to track time for (e.g. "Work", "Piano", "qadrant")'),
  specialization: z
    .string()
    .max(200, 'Specialization must not exceed 200 characters')
    .optional()
    .describe('Optional sub-level specialization or task detail (e.g. "Designing schema", "Scales")'),
}).strict();

export const ListEntriesSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_LIST_LIMIT)
    .default(10)
    .describe('Maximum number of entries to return (1-100, default 10)'),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe('Number of entries to skip for pagination'),
  response_format: z
    .nativeEnum(ResponseFormat)
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable"),
}).strict();

export const GroupByEnum = z.enum(['space', 'combo', 'day', 'week', 'month']);
export const PeriodEnum = z.enum(['today', 'this-week', 'this-month', 'all']);

export const GetStatsSchema = z.object({
  by: GroupByEnum
    .optional()
    .describe('Group results by space|combo|day|week|month. Omit for the legacy single-number stats.'),
  period: PeriodEnum
    .default('all')
    .describe('Time window filter: today|this-week|this-month|all (default all)'),
  response_format: z
    .nativeEnum(ResponseFormat)
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable"),
}).strict();

export const AggregateSchema = z.object({
  by: GroupByEnum
    .describe('Group results by space|combo|day|week|month'),
  period: PeriodEnum
    .default('all')
    .describe('Time window filter: today|this-week|this-month|all (default all)'),
  response_format: z
    .nativeEnum(ResponseFormat)
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable"),
}).strict();

export const GetActiveTimerSchema = z.object({
  response_format: z
    .nativeEnum(ResponseFormat)
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable"),
}).strict();

export const StopTimerSchema = z.object({
  response_format: z
    .nativeEnum(ResponseFormat)
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable"),
}).strict();

export type StartTimerInput = z.infer<typeof StartTimerSchema>;
export type ListEntriesInput = z.infer<typeof ListEntriesSchema>;
export type GetStatsInput = z.infer<typeof GetStatsSchema>;
export type AggregateInput = z.infer<typeof AggregateSchema>;
export type GetActiveTimerInput = z.infer<typeof GetActiveTimerSchema>;
export type StopTimerInput = z.infer<typeof StopTimerSchema>;
```

- [ ] **Step 3: Type-check**

Run: `cd mcp-server && npx tsc --noEmit -p tsconfig.json`
Expected: 0 errors.

- [ ] **Step 4: Run the existing test suite to confirm no regression**

Run: `cd mcp-server && npx vitest run`
Expected: all pre-existing tests still pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/viardant/Code/qadrant
git add mcp-server/src/schemas.ts
git commit -m "feat(mcp): add AggregateSchema and extend GetStatsSchema"
```

---

### Task 12: Extend getStats to handle by/period

**Files:**
- Modify: `mcp-server/src/tools/stats.ts` — branch on `input.by` to legacy vs grouped path

- [ ] **Step 1: Read the current stats.ts**

The current file is at `mcp-server/src/tools/stats.ts`. It exports `getStats(config, input)` and returns `{ text, structured }` where `structured.stats` is `{ total_hours, session_count, overall_count }`.

- [ ] **Step 2: Replace stats.ts**

Overwrite `mcp-server/src/tools/stats.ts` with:

```typescript
import { apiCall } from '../services/api-client.js';
import type { Config, StructuredTimerResult } from '../types.js';
import type { GetStatsInput } from '../schemas.js';
import { ResponseFormat } from '../types.js';
import { MAX_STATS_ENTRIES } from '../constants.js';
import {
  aggregateBy,
  formatAggregateText,
  formatAggregateJson,
  type TimeEntryRecordForAgg,
  type GroupBy,
} from './aggregate.js';

export async function getStats(
  config: Config,
  input: GetStatsInput
): Promise<{ text: string; structured: StructuredTimerResult }> {
  const filter = `user='${config.user_id}' && completion_time!=""`;
  const url =
    `/api/collections/time_entries/records` +
    `?filter=${encodeURIComponent(filter)}` +
    `&perPage=${MAX_STATS_ENTRIES}` +
    `&sort=-start_date`;

  const response = (await apiCall(config.pb_url, config.auth_token, url)) as {
    items?: Array<{ id: string; space: string; specialization?: string; start_date: string; completion_time: string }>;
    totalItems?: number;
  };

  const rawEntries = response.items || [];
  const totalCount = response.totalItems ?? rawEntries.length;
  const entries: TimeEntryRecordForAgg[] = rawEntries
    .filter((e) => e.completion_time)
    .map((e) => ({
      id: e.id,
      space: e.space || '',
      specialization: e.specialization || '',
      start_date: e.start_date,
      completion_time: e.completion_time,
    }));

  if (input.by) {
    const result = aggregateBy(entries, { by: input.by as GroupBy, period: input.period });
    if (input.response_format === ResponseFormat.JSON) {
      const json = formatAggregateJson(result);
      const structured: StructuredTimerResult = {
        status: 'stats_aggregated',
        message: `Aggregated ${result.rows.length} group(s) by ${input.by}`,
        stats: {
          total_hours: result.total.hours,
          session_count: result.total.sessions,
          overall_count: totalCount,
        },
      };
      return { text: json, structured };
    }
    const text = formatAggregateText(result);
    const structured: StructuredTimerResult = {
      status: 'stats_aggregated',
      message: `Aggregated ${result.rows.length} group(s) by ${input.by}`,
      stats: {
        total_hours: result.total.hours,
        session_count: result.total.sessions,
        overall_count: totalCount,
      },
    };
    return { text, structured };
  }

  // Legacy no-by path — unchanged.
  let totalMs = 0;
  for (const entry of rawEntries) {
    const start = new Date(entry.start_date).getTime();
    const end = new Date(entry.completion_time).getTime();
    totalMs += Math.max(0, end - start);
  }

  const totalHours = totalMs / (1000 * 60 * 60);
  const warning = totalCount > rawEntries.length
    ? ` (analyzing your ${rawEntries.length} most recent entries out of ${totalCount} total)`
    : '';

  if (input.response_format === ResponseFormat.JSON) {
    const structured: StructuredTimerResult = {
      status: 'stats_computed',
      message: `Total tracked hours: ${totalHours.toFixed(2)}`,
      stats: {
        total_hours: totalHours,
        session_count: rawEntries.length,
        overall_count: totalCount,
      },
    };
    return {
      text: JSON.stringify(structured, null, 2),
      structured,
    };
  }

  const text = `TOTAL_TRACKED_HOURS: ${totalHours.toFixed(2)} hours tracked across ${rawEntries.length} completed sessions${warning}.`;

  return {
    text,
    structured: {
      status: 'stats_computed',
      message: `Total tracked hours: ${totalHours.toFixed(2)}`,
      stats: {
        total_hours: totalHours,
        session_count: rawEntries.length,
        overall_count: totalCount,
      },
    },
  };
}
```

- [ ] **Step 3: Type-check**

Run: `cd mcp-server && npx tsc --noEmit -p tsconfig.json`
Expected: 0 errors.

- [ ] **Step 4: Run the existing test suite to confirm the legacy path still passes**

Run: `cd mcp-server && npx vitest run`
Expected: all pre-existing `getStats` tests pass (no `by` argument → legacy path).

- [ ] **Step 5: Commit**

```bash
cd /Users/viardant/Code/qadrant
git add mcp-server/src/tools/stats.ts
git commit -m "feat(mcp): extend getStats with by/period (legacy path unchanged)"
```

---

### Task 13: Wire qadrant_aggregate tool

**Files:**
- Create: `mcp-server/src/tools/aggregate-handler.ts`
- Modify: `mcp-server/src/index.ts` — register the new tool

- [ ] **Step 1: Write the failing test for the new tool**

Append to `mcp-server/src/index.test.ts`:

```typescript
import { qadrantAggregate } from './tools/aggregate-handler.js';

describe('qadrantAggregate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('aggregates by space in markdown format', async () => {
    const start = '2026-06-15T10:00:00.000Z';
    const end = '2026-06-15T12:00:00.000Z';
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [
          { id: '1', space: 'Work', specialization: 'frontend', start_date: start, completion_time: end },
          { id: '2', space: 'Work', specialization: 'frontend', start_date: start, completion_time: end },
          { id: '3', space: 'Piano', specialization: '', start_date: start, completion_time: end },
        ],
        totalItems: 3,
      }),
    });

    const result = await qadrantAggregate(makeConfig(), {
      by: 'space',
      period: 'all',
      response_format: ResponseFormat.MARKDOWN,
    });
    expect(result.text).toContain('DIMENSION: SPACE');
    expect(result.text).toContain('Work');
    expect(result.text).toContain('Piano');
    expect(result.structured.status).toBe('aggregate_computed');
  });

  it('aggregates in JSON format', async () => {
    const start = '2026-06-15T10:00:00.000Z';
    const end = '2026-06-15T11:00:00.000Z';
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [
          { id: '1', space: 'Work', start_date: start, completion_time: end },
        ],
        totalItems: 1,
      }),
    });

    const result = await qadrantAggregate(makeConfig(), {
      by: 'space',
      period: 'all',
      response_format: ResponseFormat.JSON,
    });
    const parsed = JSON.parse(result.text);
    expect(parsed.by).toBe('space');
    expect(parsed.rows[0].key).toBe('Work');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mcp-server && npx vitest run src/index.test.ts`
Expected: FAIL with "Cannot find module './tools/aggregate-handler.js'".

- [ ] **Step 3: Create the aggregate handler**

Create `mcp-server/src/tools/aggregate-handler.ts`:

```typescript
import { apiCall } from '../services/api-client.js';
import type { Config, StructuredTimerResult } from '../types.js';
import type { AggregateInput } from '../schemas.js';
import { ResponseFormat } from '../types.js';
import { MAX_STATS_ENTRIES } from '../constants.js';
import {
  aggregateBy,
  formatAggregateText,
  formatAggregateJson,
  type TimeEntryRecordForAgg,
  type GroupBy,
} from './aggregate.js';

export async function qadrantAggregate(
  config: Config,
  input: AggregateInput
): Promise<{ text: string; structured: StructuredTimerResult }> {
  const filter = `user='${config.user_id}' && completion_time!=""`;
  const url =
    `/api/collections/time_entries/records` +
    `?filter=${encodeURIComponent(filter)}` +
    `&perPage=${MAX_STATS_ENTRIES}` +
    `&sort=-start_date`;

  const response = (await apiCall(config.pb_url, config.auth_token, url)) as {
    items?: Array<{ id: string; space: string; specialization?: string; start_date: string; completion_time: string }>;
    totalItems?: number;
  };

  const rawEntries = response.items || [];
  const totalCount = response.totalItems ?? rawEntries.length;
  const entries: TimeEntryRecordForAgg[] = rawEntries
    .filter((e) => e.completion_time)
    .map((e) => ({
      id: e.id,
      space: e.space || '',
      specialization: e.specialization || '',
      start_date: e.start_date,
      completion_time: e.completion_time,
    }));

  const result = aggregateBy(entries, { by: input.by as GroupBy, period: input.period });

  const structured: StructuredTimerResult = {
    status: 'aggregate_computed',
    message: `Aggregated ${result.rows.length} group(s) by ${input.by}`,
    stats: {
      total_hours: result.total.hours,
      session_count: result.total.sessions,
      overall_count: totalCount,
    },
  };

  if (input.response_format === ResponseFormat.JSON) {
    return { text: formatAggregateJson(result), structured };
  }
  return { text: formatAggregateText(result), structured };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd mcp-server && npx vitest run src/index.test.ts`
Expected: PASS, both new tests green.

- [ ] **Step 5: Commit**

```bash
cd /Users/viardant/Code/qadrant
git add mcp-server/src/tools/aggregate-handler.ts mcp-server/src/index.test.ts
git commit -m "feat(mcp): add qadrant_aggregate handler"
```

---

### Task 14: Register qadrant_aggregate in server

**Files:**
- Modify: `mcp-server/src/index.ts` — import the schema, handler, and register the new tool

- [ ] **Step 1: Update the imports at the top of `mcp-server/src/index.ts`**

Replace the existing import block (the one that imports from `./schemas.js` and `./tools/*`) with:

```typescript
import {
  StartTimerSchema,
  ListEntriesSchema,
  GetStatsSchema,
  GetActiveTimerSchema,
  StopTimerSchema,
  AggregateSchema,
} from './schemas.js';
import type {
  StartTimerInput,
  ListEntriesInput,
  GetStatsInput,
  GetActiveTimerInput,
  StopTimerInput,
  AggregateInput,
} from './schemas.js';
import { startTimer, stopTimer, getActiveTimer } from './tools/timer.js';
import { listEntries } from './tools/entries.js';
import { getStats } from './tools/stats.js';
import { qadrantAggregate } from './tools/aggregate-handler.js';
```

- [ ] **Step 2: Register the new tool**

Append the following block to `mcp-server/src/index.ts` just before `async function main()`:

```typescript
server.registerTool(
  'qadrant_aggregate',
  {
    title: 'Aggregate Time Entries',
    description: `Aggregates completed time entries by a chosen dimension over a preset time window.

Useful for the agent to answer questions like "how many hours did I spend on Work this month?" or "what is my distribution across spaces this week?" without fetching raw entries and computing on the fly.

Args:
  - by (string, required): Group dimension. One of "space" | "combo" | "day" | "week" | "month".
  - period (string, optional): Time window. One of "today" | "this-week" | "this-month" | "all". Default "all".
  - response_format (string, optional): 'markdown' (default) or 'json'.

Returns:
  For markdown: a DIMENSION/PERIOD/WINDOW header followed by a KEY/HOURS/SESSIONS/SHARE table and a TOTAL row.
  For json: the structured envelope { by, period, window, rows: [{key, hours, sessions, share}], total: {hours, sessions} }.

Error Handling:
  - Returns auth error if not logged in
  - Returns API error if PocketBase is unreachable`,
    inputSchema: AggregateSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async (input: AggregateInput) => {
    const config = await readConfig();
    if (!config) {
      return {
        content: [{ type: 'text', text: 'Error: Not authenticated. Please login first: qadrant login <token>' }],
        isError: true,
      };
    }

    try {
      const result = await qadrantAggregate(config, input);
      return {
        content: [{ type: 'text', text: result.text }],
        structuredContent: result.structured,
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: handleApiError(err) }],
        isError: true,
      };
    }
  }
);
```

- [ ] **Step 3: Update the `qadrant_get_stats` description**

Find the existing `qadrant_get_stats` registration block in `mcp-server/src/index.ts` and replace its `description:` string with:

```typescript
    description: `Calculates cumulative tracked hours and displays total time analytics. Optionally groups results by a chosen dimension.

Aggregates duration across all completed time entries to compute total tracked hours. When 'by' is provided, returns a grouped table instead of the legacy single-number total.

Args:
  - by (string, optional): "space" | "combo" | "day" | "week" | "month". Omit for the legacy single-number stats.
  - period (string, optional): "today" | "this-week" | "this-month" | "all" (default "all").
  - response_format (string, optional): 'markdown' (default) or 'json'.

Returns:
  For markdown (no 'by'): Total hours and session count.
  For markdown (with 'by'): A grouped table with KEY/HOURS/SESSIONS/SHARE.
  For json: Structured payload (single-number or grouped depending on 'by').

Note: If you have more than 1000 entries, stats are computed from the most recent 1000.

Error Handling:
  - Returns auth error if not logged in`,
```

- [ ] **Step 4: Type-check**

Run: `cd mcp-server && npx tsc --noEmit -p tsconfig.json`
Expected: 0 errors.

- [ ] **Step 5: Run the full test suite**

Run: `cd mcp-server && npx vitest run`
Expected: all tests pass, including the new `qadrantAggregate` tests and the unchanged legacy `getStats` tests.

- [ ] **Step 6: Build**

Run: `cd mcp-server && npm run build`
Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
cd /Users/viardant/Code/qadrant
git add mcp-server/src/index.ts
git commit -m "feat(mcp): register qadrant_aggregate tool"
```

---

## Acceptance Checklist (from spec §12)

Run these after all tasks are complete:

- [ ] `cd cli && npx vitest run` — all green
- [ ] `cd cli && npx tsc --noEmit -p tsconfig.json` — 0 errors
- [ ] `cd cli && npm run build` — succeeds
- [ ] `cd mcp-server && npx vitest run` — all green
- [ ] `cd mcp-server && npx tsc --noEmit -p tsconfig.json` — 0 errors
- [ ] `cd mcp-server && npm run build` — succeeds
- [ ] `qadrant stats` (no flags, with valid config) — still prints `TOTAL_TRACKED_HOURS: …` (backward compat)
- [ ] `qadrant aggregate --by space --period all` (with valid config) — prints a sorted KEY/HOURS/SESSIONS/SHARE table summing to the same total as `qadrant stats`
- [ ] `qadrant aggregate --by day --period this-week` — 0–7 rows
- [ ] `qadrant aggregate --by combo --period this-month --format json` — JSON envelope parses per spec §7
- [ ] `qadrant stats --by space --period today --format json` — same JSON envelope as `qadrant aggregate`
- [ ] `qadrant aggregate --by bogus` — exits 1 with the documented error
- [ ] `qadrant aggregate --period bogus --by space` — exits 1 with the documented error
- [ ] `qadrant aggregate --by space --format bogus` — exits 1 with the documented error
- [ ] `qadrant_aggregate` MCP tool returns the §7 envelope
- [ ] `qadrant_get_stats` MCP tool with no `by` returns the legacy single-number shape (regression)
