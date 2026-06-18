import { describe, it, expect } from 'vitest';
import type { TimeEntry } from './time-entry';
import {
  transformToWeeklyData,
  transformToMonthlyData,
  transformToSpaceDistribution,
  transformToDailyTrend,
  getAggregateStats,
  getStreakDays,
  getSessionCount,
  getLastRelative,
  getMasteryIndex,
  getBestDayHours,
  getDailyTotals,
} from './transform';

const mockEntries: TimeEntry[] = [
  {
    id: '1',
    space: 'Work',
    specialization: 'qadrant',
    start_date: '2026-06-08T09:00:00.000Z', // Monday
    completion_time: '2026-06-08T11:30:00.000Z', // 2.5 hours
    user: 'u1'
  },
  {
    id: '2',
    space: 'Piano',
    specialization: 'scales',
    start_date: '2026-06-08T14:00:00.000Z',
    completion_time: '2026-06-08T15:00:00.000Z', // 1.0 hour
    user: 'u1'
  },
  {
    id: '3',
    space: 'Work',
    specialization: 'client',
    start_date: '2026-06-09T10:00:00.000Z', // Tuesday
    completion_time: '2026-06-09T14:00:00.000Z', // 4.0 hours
    user: 'u1'
  },
  {
    id: '4',
    space: 'Work',
    specialization: 'qadrant',
    start_date: '2026-05-15T09:00:00.000Z', // Previous month
    completion_time: '2026-05-15T11:00:00.000Z', // 2.0 hours
    user: 'u1'
  },
  {
    id: '5',
    space: 'Work',
    specialization: '',
    start_date: '2026-06-08T12:00:00.000Z',
    completion_time: null,
    user: 'u1'
  }
];

describe('qadrant analytics transformations', () => {
  it('should aggregate time entries correctly by week and by Space', () => {
    const result = transformToWeeklyData(mockEntries);
    // Expected: 2 weeks (2026-05-11 and 2026-06-08)
    expect(result.length).toBe(2);
    
    const juneWeek = result.find(w => w.name === '2026-06-08');
    expect(juneWeek).toBeDefined();
    expect(juneWeek?.Work).toBe(6.5); // 2.5 + 4.0
    expect(juneWeek?.Piano).toBe(1.0);
  });

  it('should aggregate time entries correctly by month and by Space', () => {
    const result = transformToMonthlyData(mockEntries);
    expect(result.length).toBe(2); // 2026-05 and 2026-06
    
    const juneMonth = result.find(m => m.name === '2026-06');
    expect(juneMonth).toBeDefined();
    expect(juneMonth?.Work).toBe(6.5);
    expect(juneMonth?.Piano).toBe(1.0);
  });

  it('should return hours grouped by Space for distribution', () => {
    const result = transformToSpaceDistribution(mockEntries);
    expect(result).toContainEqual({ name: 'Work', value: 8.5 }); // 2.5 + 4.0 + 2.0
    expect(result).toContainEqual({ name: 'Piano', value: 1.0 });
    expect(result.length).toBe(2);
  });

  it('should return daily totals in chronological order', () => {
    const result = transformToDailyTrend(mockEntries);
    expect(result.length).toBe(3);
    expect(result[0].date).toBe('2026-05-15');
    expect(result[0].hours).toBe(2.0);
    expect(result[1].date).toBe('2026-06-08');
    expect(result[1].hours).toBe(3.5); // 2.5 + 1.0
    expect(result[2].date).toBe('2026-06-09');
    expect(result[2].hours).toBe(4.0);
  });

  it('should calculate today and this week aggregate stats', () => {
    // Mock Date to evaluate relative to 2026-06-09
    const mockToday = new Date('2026-06-09T12:00:00.000Z');
    const stats = getAggregateStats(mockEntries, mockToday);
    expect(stats.todayHours).toBe(4.0);
    expect(stats.weekHours).toBe(7.5); // 2.5 + 1.0 + 4.0
  });

  it('should handle invalid dates and missing fields gracefully', () => {
    const invalidEntries: TimeEntry[] = [
      {
        id: 'e1',
        space: '', // Empty space -> should default to 'No Space'
        specialization: '',
        start_date: '2026-06-08T09:00:00.000Z',
        completion_time: '2026-06-08T10:00:00.000Z', // 1.0 hour
        user: 'u1'
      },
      {
        id: 'e2',
        space: 'Work',
        specialization: '',
        start_date: 'invalid-date-string', // Invalid start date -> should be skipped
        completion_time: '2026-06-08T11:00:00.000Z',
        user: 'u1'
      },
      {
        id: 'e3',
        space: 'Work',
        specialization: '',
        start_date: '2026-06-08T09:00:00.000Z',
        completion_time: 'invalid-date-string', // Invalid completion date -> duration 0/skipped
        user: 'u1'
      }
    ];

    // Weekly data should default empty space to 'No Space' and skip invalid start date
    const weekly = transformToWeeklyData(invalidEntries);
    expect(weekly.length).toBe(1);
    expect(weekly[0].name).toBe('2026-06-08');
    expect(weekly[0]['No Space']).toBe(1.0);
    expect(weekly[0]['Work']).toBe(0);

    // Space distribution should include 'No Space' and ignore invalid start date
    const dist = transformToSpaceDistribution(invalidEntries);
    expect(dist).toContainEqual({ name: 'No Space', value: 1.0 });
    expect(dist).toContainEqual({ name: 'Work', value: 0 });

    // Aggregate stats relative to invalid date should return 0s
    const stats = getAggregateStats(invalidEntries, new Date('invalid'));
    expect(stats.todayHours).toBe(0);
    expect(stats.weekHours).toBe(0);
  });

  it('computes streak days ending today', () => {
    const today = new Date('2026-06-18T10:00:00.000Z');
    const entries: TimeEntry[] = [
      { id: '1', space: 'W', specialization: '', start_date: '2026-06-16T09:00:00.000Z', completion_time: '2026-06-16T09:30:00.000Z', user: 'u' },
      { id: '2', space: 'W', specialization: '', start_date: '2026-06-17T09:00:00.000Z', completion_time: '2026-06-17T09:30:00.000Z', user: 'u' },
      { id: '3', space: 'W', specialization: '', start_date: '2026-06-18T09:00:00.000Z', completion_time: '2026-06-18T09:30:00.000Z', user: 'u' },
    ];
    expect(getStreakDays(entries, today)).toBe(3);
  });

  it('streak returns 0 with no completed entries', () => {
    expect(getStreakDays([], new Date('2026-06-18T00:00:00.000Z'))).toBe(0);
  });

  it('counts only completed sessions', () => {
    const entries: TimeEntry[] = [
      { id: '1', space: 'W', specialization: '', start_date: '2026-06-18T09:00:00.000Z', completion_time: '2026-06-18T09:30:00.000Z', user: 'u' },
      { id: '2', space: 'W', specialization: '', start_date: '2026-06-18T10:00:00.000Z', completion_time: null, user: 'u' },
    ];
    expect(getSessionCount(entries)).toBe(1);
  });

  it('formats last activity relative', () => {
    const now = new Date('2026-06-18T12:00:00.000Z');
    const entries: TimeEntry[] = [
      { id: '1', space: 'W', specialization: '', start_date: '2026-06-18T10:00:00.000Z', completion_time: null, user: 'u' },
    ];
    expect(getLastRelative(entries, now)).toBe('LAST_2H_AGO');
  });

  it('returns NO_RECENT_ACTIVITY when no entries', () => {
    expect(getLastRelative([], new Date('2026-06-18T12:00:00.000Z'))).toBe('NO_RECENT_ACTIVITY');
  });

  it('computes mastery index as completion rate', () => {
    const entries: TimeEntry[] = [
      { id: '1', space: 'W', specialization: '', start_date: '2026-06-18T09:00:00.000Z', completion_time: '2026-06-18T09:30:00.000Z', user: 'u' },
      { id: '2', space: 'W', specialization: '', start_date: '2026-06-18T10:00:00.000Z', completion_time: '2026-06-18T10:30:00.000Z', user: 'u' },
      { id: '3', space: 'W', specialization: '', start_date: '2026-06-18T11:00:00.000Z', completion_time: null, user: 'u' },
    ];
    expect(getMasteryIndex(entries)).toBe(66.7);
    expect(getMasteryIndex([])).toBe(0);
  });

  it('computes best day hours', () => {
    const entries: TimeEntry[] = [
      { id: '1', space: 'W', specialization: '', start_date: '2026-06-15T09:00:00.000Z', completion_time: '2026-06-15T11:00:00.000Z', user: 'u' },
      { id: '2', space: 'W', specialization: '', start_date: '2026-06-16T09:00:00.000Z', completion_time: '2026-06-16T14:00:00.000Z', user: 'u' },
    ];
    expect(getBestDayHours(entries)).toBe(5);
  });

  it('returns N daily totals ending today', () => {
    const today = new Date('2026-06-18T12:00:00.000Z');
    const entries: TimeEntry[] = [
      { id: '1', space: 'W', specialization: '', start_date: '2026-06-16T09:00:00.000Z', completion_time: '2026-06-16T10:00:00.000Z', user: 'u' },
    ];
    const totals = getDailyTotals(entries, 3, today);
    expect(totals).toHaveLength(3);
    expect(totals[0].hours).toBe(1);
    expect(totals[1].hours).toBe(0);
    expect(totals[2].hours).toBe(0);
  });
});
