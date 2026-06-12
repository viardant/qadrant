import { describe, it, expect } from 'vitest';
import { TimeEntry } from '../components/logger/TaskLogger';
import {
  transformToWeeklyData,
  transformToMonthlyData,
  transformToSpaceDistribution,
  transformToDailyTrend,
  getAggregateStats
} from './transform';

const mockEntries: TimeEntry[] = [
  {
    id: '1',
    task: 'Task 1',
    space: 'Work',
    specialization: 'apok',
    start_date: '2026-06-08T09:00:00.000Z', // Monday
    completion_time: '2026-06-08T11:30:00.000Z', // 2.5 hours
    completed: true,
    user: 'u1'
  },
  {
    id: '2',
    task: 'Task 2',
    space: 'Piano',
    specialization: 'scales',
    start_date: '2026-06-08T14:00:00.000Z',
    completion_time: '2026-06-08T15:00:00.000Z', // 1.0 hour
    completed: true,
    user: 'u1'
  },
  {
    id: '3',
    task: 'Task 3',
    space: 'Work',
    specialization: 'client',
    start_date: '2026-06-09T10:00:00.000Z', // Tuesday
    completion_time: '2026-06-09T14:00:00.000Z', // 4.0 hours
    completed: true,
    user: 'u1'
  },
  {
    id: '4',
    task: 'Task 4',
    space: 'Work',
    specialization: 'apok',
    start_date: '2026-05-15T09:00:00.000Z', // Previous month
    completion_time: '2026-05-15T11:00:00.000Z', // 2.0 hours
    completed: true,
    user: 'u1'
  },
  {
    id: '5',
    task: 'Running task',
    space: 'Work',
    specialization: '',
    start_date: '2026-06-08T12:00:00.000Z',
    completion_time: null,
    completed: false,
    user: 'u1'
  }
];

describe('apok analytics transformations', () => {
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
});
