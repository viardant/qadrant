import type { TimeEntry } from './time-entry';

export interface ChartDataPoint {
  name: string;
  [spaceName: string]: string | number;
}

export interface SpaceDistribution {
  name: string;
  value: number;
  percentage?: number;
  cumulativePercentage?: number;
}

export interface DailyTrendPoint {
  date: string;
  hours: number;
}

export type StatsScope = 'ALL_TIME' | 'THIS_YEAR' | 'THIS_QUARTER' | 'THIS_MONTH' | 'THIS_WEEK';

export interface ScopeBounds {
  start: Date | null;
  end: Date;
  priorStart: Date | null;
  priorEnd: Date | null;
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

// 9. Velocity vector — current period hours vs the immediately prior period
// of the same length. Surfaces a signed percentage change for the hero stage drop.
export interface VelocityStats {
  hasPrior: boolean; // false only for ALL_TIME
  currentHours: number;
  priorHours: number;
  deltaPct: number | null; // null when prior=0 and current>0 (render as "NEW")
  deltaHours: number; // signed
}

export function getVelocityStats(
  entries: TimeEntry[],
  scope: StatsScope,
  spaceFilter: string,
  relativeTo: Date = new Date(),
): VelocityStats {
  if (isNaN(relativeTo.getTime())) {
    return { hasPrior: false, currentHours: 0, priorHours: 0, deltaPct: 0, deltaHours: 0 };
  }
  if (scope === 'ALL_TIME') {
    return { hasPrior: false, currentHours: 0, priorHours: 0, deltaPct: 0, deltaHours: 0 };
  }
  const current = filterEntriesByScope(entries, scope, spaceFilter, relativeTo, false);
  const prior = filterEntriesByScope(entries, scope, spaceFilter, relativeTo, true);
  const currentHours = Number(
    current.reduce((sum, e) => sum + getEntryDurationHours(e), 0).toFixed(1),
  );
  const priorHours = Number(
    prior.reduce((sum, e) => sum + getEntryDurationHours(e), 0).toFixed(1),
  );
  if (priorHours === 0 && currentHours === 0) {
    return { hasPrior: true, currentHours: 0, priorHours: 0, deltaPct: 0, deltaHours: 0 };
  }
  if (priorHours === 0) {
    return { hasPrior: true, currentHours, priorHours: 0, deltaPct: null, deltaHours: currentHours };
  }
  const deltaHours = Number((currentHours - priorHours).toFixed(1));
  const deltaPct = Number((((currentHours - priorHours) / priorHours) * 100).toFixed(1));
  return { hasPrior: true, currentHours, priorHours, deltaPct, deltaHours };
}

// 9b. Modal stream — the (space, specialization) pair that defined the period.
// Returns null when there are no completed entries.
export interface ModalStream {
  space: string;
  specialization: string;
  hours: number;
  sharePct: number;
}

export function getModalStream(entries: TimeEntry[]): ModalStream | null {
  const completed = entries.filter((e) => e.completion_time);
  if (completed.length === 0) return null;
  const groups: Record<string, { space: string; specialization: string; hours: number }> = {};
  let totalHours = 0;
  for (const e of completed) {
    const space = e.space || 'No Space';
    const specialization = e.specialization || 'No Specialization';
    const key = `${space}::${specialization}`;
    const hours = getEntryDurationHours(e);
    totalHours += hours;
    if (!groups[key]) {
      groups[key] = { space, specialization, hours: 0 };
    }
    groups[key].hours += hours;
  }
  const sorted = Object.values(groups).sort((a, b) => {
    if (b.hours !== a.hours) return b.hours - a.hours;
    return `${a.space}::${a.specialization}`.localeCompare(`${b.space}::${b.specialization}`);
  });
  const top = sorted[0];
  const hours = Number(top.hours.toFixed(1));
  const sharePct = totalHours > 0 ? Math.round((top.hours / totalHours) * 100) : 0;
  return { space: top.space, specialization: top.specialization, hours, sharePct };
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

export function getScopeBounds(scope: StatsScope, relativeTo: Date = new Date()): ScopeBounds {
  const end = new Date(relativeTo);
  const nowYear = relativeTo.getFullYear();
  const nowMonth = relativeTo.getMonth();
  const nowDate = relativeTo.getDate();

  let start: Date | null = null;
  let priorStart: Date | null = null;
  let priorEnd: Date | null = null;

  switch (scope) {
    case 'THIS_WEEK': {
      const day = relativeTo.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      start = new Date(nowYear, nowMonth, nowDate + diffToMonday);
      start.setHours(0, 0, 0, 0);
      priorStart = new Date(start);
      priorStart.setDate(start.getDate() - 7);
      
      const elapsedMs = relativeTo.getTime() - start.getTime();
      priorEnd = new Date(priorStart.getTime() + elapsedMs);
      break;
    }
    case 'THIS_MONTH': {
      start = new Date(nowYear, nowMonth, 1);
      priorStart = new Date(nowYear, nowMonth - 1, 1);
      
      const elapsedMs = relativeTo.getTime() - start.getTime();
      priorEnd = new Date(priorStart.getTime() + elapsedMs);
      break;
    }
    case 'THIS_QUARTER': {
      const qStartMonth = Math.floor(nowMonth / 3) * 3;
      start = new Date(nowYear, qStartMonth, 1);
      priorStart = new Date(nowYear, qStartMonth - 3, 1);
      
      const elapsedMs = relativeTo.getTime() - start.getTime();
      priorEnd = new Date(priorStart.getTime() + elapsedMs);
      break;
    }
    case 'THIS_YEAR': {
      start = new Date(nowYear, 0, 1);
      priorStart = new Date(nowYear - 1, 0, 1);
      
      const elapsedMs = relativeTo.getTime() - start.getTime();
      priorEnd = new Date(priorStart.getTime() + elapsedMs);
      break;
    }
    case 'ALL_TIME':
    default:
      start = null;
      break;
  }

  return { start, end, priorStart, priorEnd };
}

export function filterEntriesByScope(
  entries: TimeEntry[],
  scope: StatsScope,
  spaceFilter: string,
  relativeTo: Date = new Date(),
  usePriorPeriod = false
): TimeEntry[] {
  const completed = entries.filter((e) => e.completion_time);
  const bounds = getScopeBounds(scope, relativeTo);

  const startBound = usePriorPeriod ? bounds.priorStart : bounds.start;
  const endBound = usePriorPeriod ? bounds.priorEnd : bounds.end;

  return completed.filter((e) => {
    const entryDate = new Date(e.start_date);
    if (isNaN(entryDate.getTime())) return false;
    
    // Space filter
    if (spaceFilter !== 'ALL' && e.space !== spaceFilter) {
      return false;
    }

    // Timeframe filter
    if (startBound && entryDate < startBound) return false;
    if (endBound && entryDate > endBound) return false;

    return true;
  });
}

export interface WeekdayPoint {
  day: string;
  hours: number;
}

export function getWeekdayDistribution(entries: TimeEntry[]): WeekdayPoint[] {
  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  const totals = days.map((d) => ({ day: d, hours: 0 }));

  for (const e of entries) {
    if (!e.completion_time) continue;
    const start = new Date(e.start_date);
    const end = new Date(e.completion_time);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) continue;

    let current = new Date(start);
    while (current < end) {
      const nextDay = new Date(current);
      nextDay.setHours(24, 0, 0, 0);
      const limit = nextDay < end ? nextDay : end;
      const ms = limit.getTime() - current.getTime();
      const hours = ms / (1000 * 60 * 60);

      // Map JS Sunday (0) to index 6, Monday (1) to index 0, etc.
      const dayIndex = current.getDay() === 0 ? 6 : current.getDay() - 1;
      totals[dayIndex].hours += hours;

      current = limit;
    }
  }

  return totals.map((d) => ({ ...d, hours: Number(d.hours.toFixed(2)) }));
}

export interface HeatmapCell {
  day: number; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  hour: number; // 0..23
  minutes: number;
}

function countWeekdaysInRange(start: Date, end: Date): number[] {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(23, 59, 59, 999);

  while (current <= endDay) {
    counts[current.getDay()]++;
    current.setDate(current.getDate() + 1);
  }
  return counts;
}

export function getDaytimeHeatmap(
  entries: TimeEntry[],
  scope: StatsScope = 'ALL_TIME',
  relativeTo: Date = new Date()
): HeatmapCell[] {
  const cells: HeatmapCell[] = [];
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      cells.push({ day: d, hour: h, minutes: 0 });
    }
  }

  for (const e of entries) {
    if (!e.completion_time) continue;
    const start = new Date(e.start_date);
    const end = new Date(e.completion_time);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) continue;

    let current = new Date(start);
    while (current < end) {
      const nextHour = new Date(current);
      nextHour.setHours(current.getHours() + 1, 0, 0, 0);
      const limit = nextHour < end ? nextHour : end;
      const ms = limit.getTime() - current.getTime();
      const minutes = ms / (1000 * 60);

      const day = current.getDay();
      const hour = current.getHours();

      const cell = cells.find((c) => c.day === day && c.hour === hour);
      if (cell) {
        cell.minutes += minutes;
      }
      current = limit;
    }
  }

  const bounds = getScopeBounds(scope, relativeTo);
  const rangeStart: Date = bounds.start
    ? bounds.start
    : (() => {
        const dates = entries
          .map((e) => new Date(e.start_date))
          .filter((d) => !isNaN(d.getTime()));
        return dates.length > 0
          ? new Date(Math.min(...dates.map((d) => d.getTime())))
          : relativeTo;
      })();
  const rangeEnd: Date = relativeTo;

  const weekdayCounts = countWeekdaysInRange(rangeStart, rangeEnd);

  return cells.map((c) => ({
    ...c,
    minutes: Math.round(c.minutes / Math.max(1, weekdayCounts[c.day])),
  }));
}

export function getStartTimeHeatmap(entries: TimeEntry[]): number[] {
  const hours = Array(24).fill(0);
  for (const e of entries) {
    const start = new Date(e.start_date);
    if (isNaN(start.getTime())) continue;
    hours[start.getHours()] += 1;
  }
  return hours;
}

export interface SessionBucket {
  label: string;
  count: number;
  percentage: number;
}

export function getSessionLengthBuckets(entries: TimeEntry[]): SessionBucket[] {
  const counts = [
    { label: '0-15m', count: 0, percentage: 0 },
    { label: '15-30m', count: 0, percentage: 0 },
    { label: '30-60m', count: 0, percentage: 0 },
    { label: '1-2h', count: 0, percentage: 0 },
    { label: '2h+', count: 0, percentage: 0 },
  ];
  const completed = entries.filter((e) => e.completion_time);
  if (completed.length === 0) return counts;

  for (const e of completed) {
    const durationMins = getEntryDurationHours(e) * 60;
    if (durationMins <= 15) {
      counts[0].count += 1;
    } else if (durationMins <= 30) {
      counts[1].count += 1;
    } else if (durationMins < 60) {
      counts[2].count += 1;
    } else if (durationMins < 120) {
      counts[3].count += 1;
    } else {
      counts[4].count += 1;
    }
  }

  return counts.map((c) => ({
    ...c,
    percentage: Math.round((c.count / completed.length) * 100),
  }));
}

export function getDeepWorkRatio(entries: TimeEntry[]): number {
  const completed = entries.filter((e) => e.completion_time);
  if (completed.length === 0) return 0;
  const deepWorkSessions = completed.filter((e) => getEntryDurationHours(e) >= 1.5);
  return Number(((deepWorkSessions.length / completed.length) * 100).toFixed(1));
}

export interface SpecializationRow {
  specialization: string;
  space: string;
  hours: number;
  lastActive: string;
}

export function getRankedLeaderboard(entries: TimeEntry[], relativeTo: Date = new Date()): SpecializationRow[] {
  const completed = entries.filter((e) => e.completion_time);
  const groups: Record<string, { space: string; hours: number; lastDate: Date }> = {};

  for (const e of completed) {
    const spec = e.specialization || 'No Specialization';
    const hours = getEntryDurationHours(e);
    const date = new Date(e.start_date);

    const key = `${e.space}::${spec}`;
    if (!groups[key]) {
      groups[key] = { space: e.space || 'No Space', hours: 0, lastDate: date };
    }
    groups[key].hours += hours;
    if (date > groups[key].lastDate) {
      groups[key].lastDate = date;
    }
  }

  return Object.entries(groups)
    .map(([key, data]) => {
      const specialization = key.split('::')[1];
      
      const diffMs = relativeTo.getTime() - data.lastDate.getTime();
      const daysAgo = Math.floor(diffMs / (24 * 60 * 60 * 1000));
      const lastActive = daysAgo <= 0 ? 'TODAY' : `${daysAgo}d_AGO`;

      return {
        specialization,
        space: data.space,
        hours: Number(data.hours.toFixed(2)),
        lastActive,
      };
    })
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 10);
}

export function getSpaceLeaderboard(entries: TimeEntry[]): SpaceDistribution[] {
  const list = transformToSpaceDistribution(entries).sort((a, b) => b.value - a.value);
  const total = list.reduce((sum, item) => sum + item.value, 0);
  
  let accumulated = 0;
  return list.map((item) => {
    accumulated += item.value;
    const percentage = total > 0 ? Math.round((item.value / total) * 100) : 0;
    const cumulativePercentage = total > 0 ? Math.round((accumulated / total) * 100) : 0;
    return {
      name: item.name,
      value: item.value,
      percentage,
      cumulativePercentage,
    };
  });
}

export function getSpecializationDistribution(entries: TimeEntry[], space: string): Array<{ name: string; value: number }> {
  const completed = entries.filter((e) => e.completion_time && e.space === space);
  const map: Record<string, number> = {};
  for (const e of completed) {
    const spec = e.specialization || 'No Specialization';
    map[spec] = (map[spec] || 0) + getEntryDurationHours(e);
  }
  return Object.entries(map)
    .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
    .sort((a, b) => b.value - a.value);
}

export function getWeekOverWeekBars(entries: TimeEntry[], relativeTo: Date = new Date()): Array<{ weekStr: string; hours: number }> {
  const completed = entries.filter((e) => e.completion_time);
  const result: Array<{ weekStr: string; hours: number }> = [];

  // Generate 8 weeks ending with current week
  for (let i = 7; i >= 0; i--) {
    const targetDate = new Date(relativeTo);
    targetDate.setDate(relativeTo.getDate() - i * 7);
    const mondayStr = getLocalWeekMondayString(targetDate);
    
    // Sum hours in this week boundary
    const nextMonday = new Date(mondayStr);
    nextMonday.setDate(nextMonday.getDate() + 7);
    const monTime = new Date(mondayStr).getTime();
    const nextMonTime = nextMonday.getTime();

    let hours = 0;
    for (const e of completed) {
      const entryTime = new Date(e.start_date).getTime();
      if (entryTime >= monTime && entryTime < nextMonTime) {
        hours += getEntryDurationHours(e);
      }
    }

    result.push({
      weekStr: mondayStr.slice(5), // MM-DD
      hours: Number(hours.toFixed(2)),
    });
  }

  return result;
}

export function getRolling30DAverage(trendPoints: DailyTrendPoint[]): number {
  if (trendPoints.length === 0) return 0;
  const sum = trendPoints.reduce((s, p) => s + p.hours, 0);
  return Number((sum / trendPoints.length).toFixed(2));
}

export function getLongestStreak(entries: TimeEntry[]): number {
  const completed = entries.filter((e) => e.completion_time);
  if (completed.length === 0) return 0;

  const daysSet = new Set<string>();
  for (const e of completed) {
    const d = new Date(e.start_date);
    if (!isNaN(d.getTime())) {
      daysSet.add(getLocalDateString(d));
    }
  }

  const sortedDays = Array.from(daysSet).sort();
  let maxStreak = 0;
  let currentStreak = 0;
  let prevDate: Date | null = null;

  for (const dayStr of sortedDays) {
    const currentDate = new Date(dayStr);
    if (!prevDate) {
      currentStreak = 1;
    } else {
      const diffTime = currentDate.getTime() - prevDate.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        currentStreak += 1;
      } else {
        if (currentStreak > maxStreak) {
          maxStreak = currentStreak;
        }
        currentStreak = 1;
      }
    }
    prevDate = currentDate;
  }

  return Math.max(maxStreak, currentStreak);
}

export interface RecordLog {
  bestDay: { date: string; hours: number; daysAgo: number };
  longestStreak: { days: number };
  topSpace: { name: string; hours: number };
}

export function getRecordLog(entries: TimeEntry[], relativeTo: Date = new Date()): RecordLog {
  const completed = entries.filter((e) => e.completion_time);
  
  // Best day calculation
  const byDay: Record<string, number> = {};
  for (const e of completed) {
    const d = new Date(e.start_date);
    if (isNaN(d.getTime())) continue;
    const key = getLocalDateString(d);
    byDay[key] = (byDay[key] || 0) + getEntryDurationHours(e);
  }

  let bestDate = 'NONE';
  let bestHours = 0;
  for (const [dateStr, val] of Object.entries(byDay)) {
    if (val > bestHours) {
      bestHours = val;
      bestDate = dateStr;
    }
  }

  let daysAgo = -1;
  if (bestDate !== 'NONE') {
    const diff = relativeTo.getTime() - new Date(bestDate).getTime();
    daysAgo = Math.floor(diff / (24 * 60 * 60 * 1000));
  }

  // Top space calculation
  const spaces = transformToSpaceDistribution(entries);
  let topSpaceName = 'NONE';
  let topSpaceHours = 0;
  for (const s of spaces) {
    if (s.value > topSpaceHours) {
      topSpaceHours = s.value;
      topSpaceName = s.name;
    }
  }

  const streak = getLongestStreak(entries);

  return {
    bestDay: { date: bestDate, hours: Number(bestHours.toFixed(2)), daysAgo },
    longestStreak: { days: streak },
    topSpace: { name: topSpaceName, hours: Number(topSpaceHours.toFixed(2)) },
  };
}

export function getMilestones(entries: TimeEntry[]): string[] {
  const milestones: string[] = [];
  const completed = entries.filter((e) => e.completion_time);
  const totalSessions = completed.length;

  if (totalSessions >= 1) milestones.push('FIRST_SESSION');
  if (totalSessions >= 50) milestones.push('50_SESSIONS');
  if (totalSessions >= 100) milestones.push('100_SESSIONS');

  const spaces = transformToSpaceDistribution(entries);
  for (const s of spaces) {
    if (s.value >= 10) {
      milestones.push(`10H_IN_${s.name.toUpperCase().replace(/\s+/g, '_')}`);
    }
    if (s.value >= 100) {
      milestones.push(`100H_IN_${s.name.toUpperCase().replace(/\s+/g, '_')}`);
    }
  }

  const longestStreak = getLongestStreak(entries);
  if (longestStreak >= 7) milestones.push('7D_STREAK');
  if (longestStreak >= 30) milestones.push('30D_STREAK');

  return milestones;
}

export function hoursToIntensity(h: number): 0 | 1 | 2 | 3 {
  if (h <= 0) return 0;
  if (h < 1) return 1;
  if (h < 3) return 2;
  return 3;
}



