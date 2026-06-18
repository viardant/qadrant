import { describe, it, expect } from 'vitest';
import {
  getLocalDateString,
  getLocalMonthString,
  getLocalWeekMondayString,
  getEntryDurationHours,
  filterByPeriod,
  windowForPeriod,
  groupBy,
  aggregateBy,
  comboDisplayName,
  formatAggregateText,
  formatAggregateJson,
  type TimeEntryRecordForAgg,
  type GroupBy,
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
  it('getLocalWeekMondayString returns "Invalid Date" for invalid Date', () => {
    expect(getLocalWeekMondayString(new Date('not-a-date'))).toBe('Invalid Date');
  });
  it('getEntryDurationHours returns 0 for an entry with completion_time before start_date', () => {
    expect(
      getEntryDurationHours(entry({ start_date: '2026-06-18T12:00:00.000Z', completion_time: '2026-06-18T10:00:00.000Z' }))
    ).toBe(0);
  });
});

describe('MCP aggregate: windowForPeriod', () => {
  const now = new Date(2026, 5, 17, 14, 0, 0);
  it('today returns single-day window', () => {
    expect(windowForPeriod('today', now)).toEqual({ start: '2026-06-17', end: '2026-06-17' });
  });
  it('this-week returns Mon-Sun', () => {
    expect(windowForPeriod('this-week', now)).toEqual({ start: '2026-06-15', end: '2026-06-21' });
  });
  it('this-month returns month bounds', () => {
    expect(windowForPeriod('this-month', now)).toEqual({ start: '2026-06-01', end: '2026-06-30' });
  });
  it('all returns null', () => {
    expect(windowForPeriod('all', now)).toBeNull();
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

  it('aggregateBy with empty entries returns no rows', () => {
    const r = aggregateBy([], { by: 'space', period: 'today' }, now);
    expect(r.rows).toEqual([]);
    expect(r.total).toEqual({ hours: 0, sessions: 0 });
  });
});

describe('MCP aggregate: formatters', () => {
  it('formatAggregateJson parses to the documented envelope', () => {
    const r = aggregateBy(
      [entry({ space: 'Work', start_date: '2026-06-15T10:00:00.000Z', completion_time: '2026-06-15T12:00:00.000Z' })],
      { by: 'space', period: 'all' },
      new Date(2026, 5, 17)
    );
    const parsed = JSON.parse(formatAggregateJson(r));
    expect(parsed.by).toBe('space');
    expect(parsed.rows[0].key).toBe('Work');
  });

  it('formatAggregateText includes DIMENSION header', () => {
    const r = aggregateBy(
      [entry({ space: 'Work', start_date: '2026-06-15T10:00:00.000Z', completion_time: '2026-06-15T12:00:00.000Z' })],
      { by: 'space', period: 'all' },
      new Date(2026, 5, 17)
    );
    expect(formatAggregateText(r)).toContain('DIMENSION: SPACE');
  });

  it('formatAggregateText shows NO_DATA for empty results', () => {
    const r = aggregateBy([], { by: 'space', period: 'all' }, new Date(2026, 5, 17));
    expect(formatAggregateText(r)).toContain('NO_DATA');
  });
});
