import { TimeEntry } from '../components/logger/TaskLogger';

export interface ChartDataPoint {
  name: string;
  [spaceName: string]: string | number;
}

export interface SpaceDistribution {
  name: string;
  value: number;
}

export interface DailyTrendPoint {
  date: string;
  hours: number;
}

// Get local date string 'YYYY-MM-DD' from Date object
export function getLocalDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Get local month string 'YYYY-MM' from Date object
export function getLocalMonthString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// Get Monday of the week (local time) as 'YYYY-MM-DD'
export function getLocalWeekMondayString(d: Date): string {
  const dayOfWeek = d.getDay(); // 0 = Sunday, 1 = Monday, ...
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  return getLocalDateString(monday);
}

// Calculate decimal hours of a completed entry
export function getEntryDurationHours(entry: TimeEntry): number {
  if (!entry.completion_time) return 0;
  const start = new Date(entry.start_date);
  const end = new Date(entry.completion_time);
  const ms = end.getTime() - start.getTime();
  return Math.max(0, ms / (1000 * 60 * 60));
}

// 1. Weekly Stacked Data
export function transformToWeeklyData(entries: TimeEntry[]): ChartDataPoint[] {
  const completed = entries.filter(e => e.completion_time);
  const weeks: Record<string, Record<string, number>> = {};
  const spaces = new Set<string>();

  for (const entry of completed) {
    const date = new Date(entry.start_date);
    const weekKey = getLocalWeekMondayString(date);
    const space = entry.space || 'No Space';
    const hours = getEntryDurationHours(entry);
    
    spaces.add(space);
    if (!weeks[weekKey]) {
      weeks[weekKey] = {};
    }
    weeks[weekKey][space] = (weeks[weekKey][space] || 0) + hours;
  }

  return Object.keys(weeks)
    .sort()
    .map(weekKey => {
      const point: ChartDataPoint = { name: weekKey };
      for (const space of spaces) {
        point[space] = Number((weeks[weekKey][space] || 0).toFixed(2));
      }
      return point;
    });
}

// 2. Monthly Stacked Data
export function transformToMonthlyData(entries: TimeEntry[]): ChartDataPoint[] {
  const completed = entries.filter(e => e.completion_time);
  const months: Record<string, Record<string, number>> = {};
  const spaces = new Set<string>();

  for (const entry of completed) {
    const date = new Date(entry.start_date);
    const monthKey = getLocalMonthString(date);
    const space = entry.space || 'No Space';
    const hours = getEntryDurationHours(entry);

    spaces.add(space);
    if (!months[monthKey]) {
      months[monthKey] = {};
    }
    months[monthKey][space] = (months[monthKey][space] || 0) + hours;
  }

  return Object.keys(months)
    .sort()
    .map(monthKey => {
      const point: ChartDataPoint = { name: monthKey };
      for (const space of spaces) {
        point[space] = Number((months[monthKey][space] || 0).toFixed(2));
      }
      return point;
    });
}

// 3. Space Distribution
export function transformToSpaceDistribution(entries: TimeEntry[]): SpaceDistribution[] {
  const completed = entries.filter(e => e.completion_time);
  const spaces: Record<string, number> = {};

  for (const entry of completed) {
    const space = entry.space || 'No Space';
    const hours = getEntryDurationHours(entry);
    spaces[space] = (spaces[space] || 0) + hours;
  }

  return Object.keys(spaces).map(name => ({
    name,
    value: Number(spaces[name].toFixed(2))
  }));
}

// 4. Daily Trend
export function transformToDailyTrend(entries: TimeEntry[]): DailyTrendPoint[] {
  const completed = entries.filter(e => e.completion_time);
  const days: Record<string, number> = {};

  for (const entry of completed) {
    const date = new Date(entry.start_date);
    const dayKey = getLocalDateString(date);
    const hours = getEntryDurationHours(entry);
    days[dayKey] = (days[dayKey] || 0) + hours;
  }

  return Object.keys(days)
    .sort()
    .map(date => ({
      date,
      hours: Number(days[date].toFixed(2))
    }));
}

// 5. Aggregate Stats (Today and This Week)
export function getAggregateStats(entries: TimeEntry[], relativeTo: Date = new Date()) {
  const completed = entries.filter(e => e.completion_time);
  const todayStr = getLocalDateString(relativeTo);
  const thisWeekStr = getLocalWeekMondayString(relativeTo);

  let todayHours = 0;
  let weekHours = 0;

  for (const entry of completed) {
    const date = new Date(entry.start_date);
    const dayStr = getLocalDateString(date);
    const weekStr = getLocalWeekMondayString(date);
    const hours = getEntryDurationHours(entry);

    if (dayStr === todayStr) {
      todayHours += hours;
    }
    if (weekStr === thisWeekStr) {
      weekHours += hours;
    }
  }

  return {
    todayHours: Number(todayHours.toFixed(2)),
    weekHours: Number(weekHours.toFixed(2))
  };
}
