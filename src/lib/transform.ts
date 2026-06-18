import type { TimeEntry } from './time-entry';

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
  if (isNaN(d.getTime())) return 'Invalid Date';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Get local month string 'YYYY-MM' from Date object
export function getLocalMonthString(d: Date): string {
  if (isNaN(d.getTime())) return 'Invalid Date';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// Get Monday of the week (local time) as 'YYYY-MM-DD'
export function getLocalWeekMondayString(d: Date): string {
  if (isNaN(d.getTime())) return 'Invalid Date';
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
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
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
    if (isNaN(date.getTime())) continue;
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
    if (isNaN(date.getTime())) continue;
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
    const start = new Date(entry.start_date);
    if (isNaN(start.getTime())) continue;
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
    if (isNaN(date.getTime())) continue;
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
  if (isNaN(relativeTo.getTime())) {
    return { todayHours: 0, weekHours: 0 };
  }
  const completed = entries.filter(e => e.completion_time);
  const todayStr = getLocalDateString(relativeTo);
  const thisWeekStr = getLocalWeekMondayString(relativeTo);

  let todayHours = 0;
  let weekHours = 0;

  for (const entry of completed) {
    const date = new Date(entry.start_date);
    if (isNaN(date.getTime())) continue;
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

// 6. Streak: count of consecutive days ending today (or yesterday) with at least one completed entry
export function getStreakDays(entries: TimeEntry[], relativeTo: Date = new Date()): number {
  if (isNaN(relativeTo.getTime())) return 0;
  const completed = entries.filter((e) => e.completion_time);
  if (completed.length === 0) return 0;

  const daySet = new Set<string>();
  for (const e of completed) {
    const d = new Date(e.start_date);
    if (isNaN(d.getTime())) continue;
    daySet.add(getLocalDateString(d));
  }

  let streak = 0;
  const cursor = new Date(relativeTo);
  // If no entry today but there is one yesterday, count from yesterday.
  if (!daySet.has(getLocalDateString(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!daySet.has(getLocalDateString(cursor))) return 0;
  }

  while (daySet.has(getLocalDateString(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// 7. Session count
export function getSessionCount(entries: TimeEntry[]): number {
  return entries.filter((e) => e.completion_time).length;
}

// 8. Last activity relative descriptor — "LAST_XD_AGO" / "LAST_XH_AGO" / "LAST_NOW"
export function getLastRelative(entries: TimeEntry[], relativeTo: Date = new Date()): string {
  if (isNaN(relativeTo.getTime())) return 'NO_RECENT_ACTIVITY';
  if (entries.length === 0) return 'NO_RECENT_ACTIVITY';
  const sorted = [...entries].sort(
    (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime(),
  );
  const lastStart = new Date(sorted[0].start_date);
  if (isNaN(lastStart.getTime())) return 'NO_RECENT_ACTIVITY';
  const diffMs = relativeTo.getTime() - lastStart.getTime();
  if (diffMs < 60_000) return 'LAST_NOW';
  if (diffMs < 60 * 60_000) {
    const mins = Math.floor(diffMs / 60_000);
    return `LAST_${mins}M_AGO`;
  }
  if (diffMs < 24 * 60 * 60_000) {
    const hrs = Math.floor(diffMs / (60 * 60_000));
    return `LAST_${hrs}H_AGO`;
  }
  const days = Math.floor(diffMs / (24 * 60 * 60_000));
  return `LAST_${days}D_AGO`;
}

// 9. Total Mastery Index — placeholder formula until a real definition is provided.
// Currently: completion rate * 100, capped at 100. Returns 0 with no data.
export function getMasteryIndex(entries: TimeEntry[]): number {
  if (entries.length === 0) return 0;
  const completed = entries.filter((e) => e.completion_time).length;
  return Math.min(100, Number(((completed / entries.length) * 100).toFixed(1)));
}

// 10. Best day (max hours in any single day from completed entries)
export function getBestDayHours(entries: TimeEntry[]): number {
  const completed = entries.filter((e) => e.completion_time);
  if (completed.length === 0) return 0;
  const byDay: Record<string, number> = {};
  for (const e of completed) {
    const d = new Date(e.start_date);
    if (isNaN(d.getTime())) continue;
    const key = getLocalDateString(d);
    byDay[key] = (byDay[key] || 0) + getEntryDurationHours(e);
  }
  let max = 0;
  for (const v of Object.values(byDay)) {
    if (v > max) max = v;
  }
  return Number(max.toFixed(2));
}

// 11. Daily totals (last N days) — used by heatmap and line chart
export function getDailyTotals(
  entries: TimeEntry[],
  days: number,
  relativeTo: Date = new Date(),
): Array<{ date: Date; dateStr: string; hours: number }> {
  if (isNaN(relativeTo.getTime())) return [];
  const completed = entries.filter((e) => e.completion_time);
  const map: Record<string, number> = {};
  for (const e of completed) {
    const d = new Date(e.start_date);
    if (isNaN(d.getTime())) continue;
    const key = getLocalDateString(d);
    map[key] = (map[key] || 0) + getEntryDurationHours(e);
  }

  const result: Array<{ date: Date; dateStr: string; hours: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(relativeTo);
    d.setDate(relativeTo.getDate() - i);
    const dateStr = getLocalDateString(d);
    result.push({
      date: d,
      dateStr,
      hours: Number((map[dateStr] || 0).toFixed(2)),
    });
  }
  return result;
}
