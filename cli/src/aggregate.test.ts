import { describe, it, expect } from 'vitest';
import {
  getLocalDateString,
  getLocalMonthString,
  getLocalWeekMondayString,
  getEntryDurationHours,
  filterByPeriod,
  windowForPeriod,
  type Period,
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
