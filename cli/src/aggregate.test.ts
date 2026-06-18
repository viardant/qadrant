import { describe, it, expect } from 'vitest';
import {
  getLocalDateString,
  getLocalMonthString,
  getLocalWeekMondayString,
  getEntryDurationHours,
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
