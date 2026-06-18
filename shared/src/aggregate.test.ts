import { describe, it, expect } from 'vitest';
import { getLocalDateString, getLocalMonthString, getLocalWeekMondayString, getEntryDurationHours } from './date-helpers.js';
import type { TimeEntry, GroupBy, Period, AggregateResult } from './types.js';
import {
  filterByPeriod,
  filterByCustomRange,
  windowForPeriod,
  groupBy,
  comboDisplayName,
  aggregateBy,
  formatAggregateText,
  formatAggregateJson,
} from './aggregate.js';

const entry = (startISO: string, completionISO: string | null = null, overrides: Partial<TimeEntry> = {}): TimeEntry => ({
  id: '1',
  space: 'W',
  specialization: '',
  start_date: startISO,
  completion_time: completionISO,
  user: 'u',
  ...overrides,
});

const mkEntry = (overrides: Partial<TimeEntry> = {}): TimeEntry => ({
  id: '1',
  space: 'W',
  specialization: '',
  start_date: '2026-06-18T10:00:00.000Z',
  completion_time: '2026-06-18T11:00:00.000Z',
  user: 'u',
  ...overrides,
});

const e = (space: string, specialization: string, startISO: string, completionISO: string | null = null): TimeEntry => ({
  id: '1',
  space,
  specialization,
  start_date: startISO,
  completion_time: completionISO,
  user: 'u',
});

// ---- date-helpers tests (ported from CLI) ----

describe('getLocalDateString', () => {
  it('formats a date as YYYY-MM-DD', () => {
    const d = new Date(2026, 5, 18);
    expect(getLocalDateString(d)).toBe('2026-06-18');
  });

  it('zero-pads single-digit months and days', () => {
    const d = new Date(2026, 0, 5);
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
    const monday = new Date(2026, 5, 15);
    expect(getLocalWeekMondayString(monday)).toBe('2026-06-15');
  });

  it('rolls back to the prior Monday for a Wednesday', () => {
    const wednesday = new Date(2026, 5, 17);
    expect(getLocalWeekMondayString(wednesday)).toBe('2026-06-15');
  });

  it('rolls back to the prior Monday for a Sunday', () => {
    const sunday = new Date(2026, 5, 21);
    expect(getLocalWeekMondayString(sunday)).toBe('2026-06-15');
  });

  it('returns "Invalid Date" for an invalid Date', () => {
    expect(getLocalWeekMondayString(new Date('not-a-date'))).toBe('Invalid Date');
  });
});

describe('getEntryDurationHours', () => {
  it('returns decimal hours for a completed entry', () => {
    expect(
      getEntryDurationHours(entry('2026-06-18T10:00:00.000Z', '2026-06-18T12:30:00.000Z'))
    ).toBeCloseTo(2.5, 5);
  });

  it('returns 0 for an active entry (no completion_time)', () => {
    expect(
      getEntryDurationHours(entry('2026-06-18T10:00:00.000Z', null))
    ).toBe(0);
  });

  it('returns 0 for an entry with completion_time before start_date (negative duration)', () => {
    expect(
      getEntryDurationHours(entry('2026-06-18T12:00:00.000Z', '2026-06-18T10:00:00.000Z'))
    ).toBe(0);
  });

  it('returns 0 for an entry with an invalid completion_time', () => {
    expect(
      getEntryDurationHours(entry('2026-06-18T10:00:00.000Z', 'not-a-date'))
    ).toBe(0);
  });
});

// ---- windowForPeriod tests (ported from CLI + MCP) ----

describe('windowForPeriod', () => {
  const now = new Date(2026, 5, 17, 14, 0, 0);

  it('returns a single-day window for today', () => {
    const w = windowForPeriod('today', now);
    expect(w).toEqual({ start: '2026-06-17', end: '2026-06-17' });
  });

  it('returns a week window for this-week', () => {
    const w = windowForPeriod('this-week', now);
    expect(w).toEqual({ start: '2026-06-15', end: '2026-06-21' });
  });

  it('returns a month window for this-month', () => {
    const w = windowForPeriod('this-month', now);
    expect(w).toEqual({ start: '2026-06-01', end: '2026-06-30' });
  });

  it('returns null for all', () => {
    expect(windowForPeriod('all', now)).toBeNull();
  });
});

// ---- filterByPeriod tests (ported from CLI + MCP) ----

describe('filterByPeriod', () => {
  const now = new Date(2026, 5, 17, 14, 0, 0);

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

  it('filters today / this-week / this-month / all (MCP compact)', () => {
    const today = mkEntry({ start_date: new Date(2026, 5, 17, 9, 0, 0).toISOString() });
    const lastMonth = mkEntry({ start_date: new Date(2026, 4, 30, 9, 0, 0).toISOString() });
    const longAgo = mkEntry({ start_date: new Date(2024, 0, 1, 9, 0, 0).toISOString() });
    expect(filterByPeriod([today, lastMonth, longAgo], 'today', now)).toHaveLength(1);
    expect(filterByPeriod([today, lastMonth, longAgo], 'this-week', now)).toHaveLength(1);
    expect(filterByPeriod([today, lastMonth, longAgo], 'this-month', now)).toHaveLength(1);
    expect(filterByPeriod([today, lastMonth, longAgo], 'all', now)).toHaveLength(3);
  });
});

// ---- filterByCustomRange tests (NEW) ----

describe('filterByCustomRange', () => {
  const sample: TimeEntry[] = [
    e('Work', 'frontend', '2026-06-15T10:00:00.000Z', '2026-06-15T11:00:00.000Z'),
    e('Work', 'frontend', '2026-06-16T10:00:00.000Z', '2026-06-16T11:30:00.000Z'),
    e('Work', 'meeting',  '2026-06-17T13:00:00.000Z', '2026-06-17T14:00:00.000Z'),
    e('Piano', '',        '2026-06-20T15:00:00.000Z', '2026-06-20T16:00:00.000Z'),
  ];

  it('includes entries within the range', () => {
    const result = filterByCustomRange(sample, '2026-06-15', '2026-06-17');
    expect(result).toHaveLength(3);
  });

  it('includes boundary dates', () => {
    const result = filterByCustomRange(sample, '2026-06-15', '2026-06-15');
    expect(result).toHaveLength(1);
    expect(result[0].start_date).toBe('2026-06-15T10:00:00.000Z');
  });

  it('returns empty when no entries match', () => {
    const result = filterByCustomRange(sample, '2026-07-01', '2026-07-31');
    expect(result).toHaveLength(0);
  });

  it('drops entries with invalid start_date', () => {
    const data: TimeEntry[] = [
      entry('not-a-date'),
      e('Work', '', '2026-06-15T10:00:00.000Z', '2026-06-15T11:00:00.000Z'),
    ];
    const result = filterByCustomRange(data, '2026-06-01', '2026-06-30');
    expect(result).toHaveLength(1);
  });
});

// ---- comboDisplayName tests (ported from CLI) ----

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

// ---- groupBy tests (ported from CLI) ----

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
    expect(byWeek).toContain('2026-06-15');

    const byMonth = groupBy(sample, 'month').map((r) => r.key);
    expect(byMonth).toContain('2026-06');
  });

  it('sums hours and counts completed entries only', () => {
    const result = groupBy(sample, 'combo');
    const frontend = result.find((r) => r.key === 'Work / frontend');
    expect(frontend).toBeDefined();
    expect(frontend!.hours).toBeCloseTo(2.5, 5);
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

// ---- aggregateBy tests (ported from CLI + MCP + NEW) ----

describe('aggregateBy', () => {
  const sample: TimeEntry[] = [
    e('Work', 'frontend', '2026-06-15T10:00:00.000Z', '2026-06-15T11:00:00.000Z'),
    e('Work', 'frontend', '2026-06-16T10:00:00.000Z', '2026-06-16T11:30:00.000Z'),
    e('Piano', '',        '2026-06-15T15:00:00.000Z', '2026-06-15T16:00:00.000Z'),
  ];

  const sampleMCP: TimeEntry[] = [
    mkEntry({ id: '1', space: 'Work', specialization: 'frontend', start_date: '2026-06-15T10:00:00.000Z', completion_time: '2026-06-15T11:00:00.000Z' }),
    mkEntry({ id: '2', space: 'Work', specialization: 'frontend', start_date: '2026-06-16T10:00:00.000Z', completion_time: '2026-06-16T11:30:00.000Z' }),
    mkEntry({ id: '3', space: 'Work', specialization: 'meeting', start_date: '2026-06-15T13:00:00.000Z', completion_time: '2026-06-15T14:00:00.000Z' }),
    mkEntry({ id: '4', space: 'Piano', specialization: '', start_date: '2026-06-15T15:00:00.000Z', completion_time: '2026-06-15T16:00:00.000Z' }),
  ];

  const now = new Date(2026, 5, 17, 14, 0, 0);

  it('produces a sorted result (hours desc, key asc)', () => {
    const result = aggregateBy(sample, { by: 'combo', period: 'all' }, now);
    expect(result.by).toBe('combo');
    expect(result.period).toBe('all');
    expect(result.window).toBeNull();
    expect(result.rows[0].key).toBe('Work / frontend');
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

  it('handles every GroupBy value (MCP)', () => {
    const bys: GroupBy[] = ['space', 'combo', 'day', 'week', 'month'];
    for (const by of bys) {
      const r = aggregateBy(sampleMCP, { by, period: 'all' }, now);
      expect(r.rows.length).toBeGreaterThan(0);
      expect(r.total.hours).toBeGreaterThan(0);
    }
  });

  it('returns rows sorted by hours desc (MCP)', () => {
    const r = aggregateBy(sampleMCP, { by: 'combo', period: 'all' }, now);
    expect(r.rows[0].key).toBe('Work / frontend');
  });

  // NEW: space filter
  it('filters by space', () => {
    const result = aggregateBy(sample, { by: 'space', period: 'all', space: 'Piano' }, now);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].key).toBe('Piano');
  });

  it('returns empty when space filter matches nothing', () => {
    const result = aggregateBy(sample, { by: 'space', period: 'all', space: 'Nonexistent' }, now);
    expect(result.rows).toHaveLength(0);
    expect(result.total.hours).toBe(0);
  });

  // NEW: specialization filter
  it('filters by specialization', () => {
    const result = aggregateBy(sample, { by: 'combo', period: 'all', specialization: 'frontend' }, now);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].key).toBe('Work / frontend');
  });

  it('returns empty when specialization filter matches nothing', () => {
    const result = aggregateBy(sample, { by: 'combo', period: 'all', specialization: 'nonexistent' }, now);
    expect(result.rows).toHaveLength(0);
  });

  // NEW: custom date range
  it('supports custom date range (from/to)', () => {
    const result = aggregateBy(sample, { by: 'space', from: '2026-06-15', to: '2026-06-15' }, now);
    expect(result.period).toBe('custom');
    expect(result.window).toEqual({ start: '2026-06-15', end: '2026-06-15' });
    expect(result.rows).toHaveLength(2);
    expect(result.rows.find((r) => r.key === 'Work')?.hours).toBeCloseTo(1.0, 5);
    expect(result.rows.find((r) => r.key === 'Piano')?.hours).toBeCloseTo(1.0, 5);
  });

  it('custom date range takes precedence over period', () => {
    const result = aggregateBy(sample, { by: 'space', period: 'all', from: '2026-06-15', to: '2026-06-15' }, now);
    expect(result.period).toBe('custom');
    expect(result.window).toEqual({ start: '2026-06-15', end: '2026-06-15' });
  });

  // NEW: includeEntries
  it('attaches entries to rows when includeEntries is true', () => {
    const result = aggregateBy(sample, { by: 'space', period: 'all', includeEntries: true }, now);
    const work = result.rows.find((r) => r.key === 'Work');
    expect(work).toBeDefined();
    expect(work!.entries).toBeDefined();
    expect(work!.entries).toHaveLength(2);
    expect(work!.entries![0].space).toBe('Work');
  });

  it('does not attach entries when includeEntries is false or omitted', () => {
    const result = aggregateBy(sample, { by: 'space', period: 'all' }, now);
    const work = result.rows.find((r) => r.key === 'Work');
    expect(work).toBeDefined();
    expect(work!.entries).toBeUndefined();
  });

  // NEW: combined space + period + includeEntries
  it('combines space filter, period filter, and includeEntries', () => {
    const entries: TimeEntry[] = [
      e('Work', 'frontend', '2026-06-15T10:00:00.000Z', '2026-06-15T11:00:00.000Z'),
      e('Work', 'backend',  '2026-06-16T10:00:00.000Z', '2026-06-16T11:00:00.000Z'),
      e('Piano', '',        '2026-06-15T15:00:00.000Z', '2026-06-15T16:00:00.000Z'),
      e('Work', 'frontend', '2026-05-15T10:00:00.000Z', '2026-05-15T11:00:00.000Z'),
    ];
    const now = new Date(2026, 5, 17, 14, 0, 0);
    const result = aggregateBy(entries, {
      by: 'combo',
      period: 'this-month',
      space: 'Work',
      includeEntries: true,
    }, now);
    expect(result.period).toBe('this-month');
    expect(result.rows.length).toBeGreaterThan(0);
    for (const row of result.rows) {
      expect(row.key.startsWith('Work')).toBe(true);
      expect(row.entries).toBeDefined();
      expect(row.entries!.length).toBeGreaterThan(0);
      for (const entryItem of row.entries!) {
        expect(entryItem.space).toBe('Work');
        const d = new Date(entryItem.start_date);
        const key = getLocalDateString(d);
        expect(key >= '2026-06-01' && key <= '2026-06-30').toBe(true);
      }
    }
  });

  // NEW: combined specialization + custom range + includeEntries
  it('combines specialization filter, custom range, and includeEntries', () => {
    const entries: TimeEntry[] = [
      e('Work', 'frontend', '2026-06-15T10:00:00.000Z', '2026-06-15T11:00:00.000Z'),
      e('Work', 'backend',  '2026-06-16T10:00:00.000Z', '2026-06-16T11:00:00.000Z'),
      e('Piano', '',        '2026-06-15T15:00:00.000Z', '2026-06-15T16:00:00.000Z'),
    ];
    const result = aggregateBy(entries, {
      by: 'space',
      from: '2026-06-15',
      to: '2026-06-16',
      specialization: 'frontend',
      includeEntries: true,
    });
    expect(result.period).toBe('custom');
    expect(result.window).toEqual({ start: '2026-06-15', end: '2026-06-16' });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].key).toBe('Work');
    expect(result.rows[0].entries).toHaveLength(1);
    expect(result.rows[0].entries![0].specialization).toBe('frontend');
  });
});

// ---- AggregateResult type tests (ported from CLI) ----

describe('AggregateResult type', () => {
  it('row has share field', () => {
    const result = aggregateBy([
      e('Work', 'frontend', '2026-06-15T10:00:00.000Z', '2026-06-15T11:00:00.000Z'),
    ], { by: 'space', period: 'all' });
    expect(result.rows[0].share).toBeDefined();
    expect(typeof result.rows[0].share).toBe('number');
  });
});

// ---- formatAggregateText tests (ported from CLI) ----

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
    expect(out).toContain('PERIOD:    THIS-MONTH');
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

  it('formats "custom" period as CUSTOM', () => {
    const custom: AggregateResult = { ...fixture(), period: 'custom', window: { start: '2026-06-01', end: '2026-06-15' } };
    const out = formatAggregateText(custom);
    expect(out).toContain('PERIOD:    CUSTOM');
    expect(out).toContain('WINDOW:    2026-06-01..2026-06-15');
  });

  it('includes DIMENSION header (MCP)', () => {
    const r = aggregateBy(
      [entry({ space: 'Work', start_date: '2026-06-15T10:00:00.000Z', completion_time: '2026-06-15T12:00:00.000Z' })],
      { by: 'space', period: 'all' },
      new Date(2026, 5, 17)
    );
    expect(formatAggregateText(r)).toContain('DIMENSION: SPACE');
  });

  it('shows NO_DATA for empty results (MCP)', () => {
    const r = aggregateBy([], { by: 'space', period: 'all' }, new Date(2026, 5, 17));
    expect(formatAggregateText(r)).toContain('NO_DATA');
  });
});

// ---- formatAggregateJson tests (ported from CLI + MCP) ----

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
    const all: AggregateResult = { ...fixture(), period: 'all', window: null };
    const parsed = JSON.parse(formatAggregateJson(all));
    expect(parsed.window).toBeNull();
  });

  it('parses to the documented envelope (MCP)', () => {
    const r = aggregateBy(
      [mkEntry({ space: 'Work', start_date: '2026-06-15T10:00:00.000Z', completion_time: '2026-06-15T12:00:00.000Z' })],
      { by: 'space', period: 'all' },
      new Date(2026, 5, 17)
    );
    const parsed = JSON.parse(formatAggregateJson(r));
    expect(parsed.by).toBe('space');
    expect(parsed.rows[0].key).toBe('Work');
  });
});
