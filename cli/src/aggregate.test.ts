import { describe, it, expect } from 'vitest';
import {
  getLocalDateString,
  getLocalMonthString,
  getLocalWeekMondayString,
  getEntryDurationHours,
  filterByPeriod,
  windowForPeriod,
  type Period,
  groupBy,
  comboDisplayName,
  type GroupBy,
} from './aggregate.js';

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

  it('returns 0 for an entry with completion_time before start_date (negative duration)', () => {
    expect(
      getEntryDurationHours({
        id: '1',
        space: 'W',
        specialization: '',
        start_date: '2026-06-18T12:00:00.000Z',
        completion_time: '2026-06-18T10:00:00.000Z',
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

const entry = (startISO: string, completionISO: string | null = null, overrides: Partial<import('./aggregate.js').TimeEntry> = {}): import('./aggregate.js').TimeEntry => ({
  id: '1',
  space: 'W',
  specialization: '',
  start_date: startISO,
  completion_time: completionISO,
  user: 'u',
  ...overrides,
});

describe('filterByPeriod', () => {
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

import { groupBy as gb, comboDisplayName as cdn, type GroupBy as GB } from './aggregate.js';

const e = (space: string, specialization: string, startISO: string, completionISO: string | null = null): import('./aggregate.js').TimeEntry => ({
  id: '1',
  space,
  specialization,
  start_date: startISO,
  completion_time: completionISO,
  user: 'u',
});

describe('comboDisplayName', () => {
  it('joins space and specialization with " / "', () => {
    expect(cdn('Work', 'frontend')).toBe('Work / frontend');
  });
  it('returns space when specialization is empty', () => {
    expect(cdn('Work', '')).toBe('Work');
  });
  it('returns specialization when space is empty', () => {
    expect(cdn('', 'frontend')).toBe('frontend');
  });
  it('returns "Untitled" when both are empty', () => {
    expect(cdn('', '')).toBe('Untitled');
  });
});

describe('groupBy', () => {
  const sample: import('./aggregate.js').TimeEntry[] = [
    e('Work', 'frontend', '2026-06-15T10:00:00.000Z', '2026-06-15T11:00:00.000Z'),
    e('Work', 'frontend', '2026-06-16T10:00:00.000Z', '2026-06-16T11:30:00.000Z'),
    e('Work', 'meeting',  '2026-06-15T13:00:00.000Z', '2026-06-15T14:00:00.000Z'),
    e('Piano', '',        '2026-06-15T15:00:00.000Z', '2026-06-15T16:00:00.000Z'),
  ];

  it('groups by space, defaulting empty to "No Space"', () => {
    const result = gb([...sample, e('', '', '2026-06-15T10:00:00.000Z', '2026-06-15T10:30:00.000Z')], 'space');
    const keys = result.map((r) => r.key);
    expect(keys).toContain('Work');
    expect(keys).toContain('Piano');
    expect(keys).toContain('No Space');
  });

  it('groups by combo', () => {
    const result = gb(sample, 'combo');
    const keys = result.map((r) => r.key);
    expect(keys).toContain('Work / frontend');
    expect(keys).toContain('Work / meeting');
    expect(keys).toContain('Piano');
  });

  it('groups by local day, week, month', () => {
    const byDay = gb(sample, 'day').map((r) => r.key);
    expect(byDay).toContain('2026-06-15');
    expect(byDay).toContain('2026-06-16');

    const byWeek = gb(sample, 'week').map((r) => r.key);
    expect(byWeek).toContain('2026-06-15');

    const byMonth = gb(sample, 'month').map((r) => r.key);
    expect(byMonth).toContain('2026-06');
  });

  it('sums hours and counts completed entries only', () => {
    const result = gb(sample, 'combo');
    const frontend = result.find((r) => r.key === 'Work / frontend');
    expect(frontend).toBeDefined();
    expect(frontend!.hours).toBeCloseTo(2.5, 5);
    expect(frontend!.sessions).toBe(2);
  });

  it('excludes active (no completion_time) entries from hours and sessions', () => {
    const data: import('./aggregate.js').TimeEntry[] = [
      e('Work', 'frontend', '2026-06-15T10:00:00.000Z', '2026-06-15T11:00:00.000Z'),
      e('Work', 'frontend', '2026-06-15T12:00:00.000Z', null),
    ];
    const result = gb(data, 'combo');
    expect(result).toHaveLength(1);
    expect(result[0].hours).toBeCloseTo(1.0, 5);
    expect(result[0].sessions).toBe(1);
  });

  it('skips entries with invalid start_date', () => {
    const data: import('./aggregate.js').TimeEntry[] = [
      e('Work', '', 'not-a-date', '2026-06-15T11:00:00.000Z'),
      e('Work', '', '2026-06-15T10:00:00.000Z', '2026-06-15T11:00:00.000Z'),
    ];
    const result = gb(data, 'space');
    expect(result).toHaveLength(1);
    expect(result[0].hours).toBeCloseTo(1.0, 5);
  });
});
