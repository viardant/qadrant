export interface TimeEntry {
  id: string;
  space: string;
  specialization: string;
  start_date: string;
  completion_time: string | null;
  user: string;
}

export function getLocalDateString(d: Date): string {
  if (isNaN(d.getTime())) return 'Invalid Date';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLocalMonthString(d: Date): string {
  if (isNaN(d.getTime())) return 'Invalid Date';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getLocalWeekMondayString(d: Date): string {
  if (isNaN(d.getTime())) return 'Invalid Date';
  const dayOfWeek = d.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(d);
  monday.setDate(monday.getDate() + diffToMonday);
  return getLocalDateString(monday);
}

export function getEntryDurationHours(entry: TimeEntry): number {
  if (!entry.completion_time) return 0;
  const start = new Date(entry.start_date);
  const end = new Date(entry.completion_time);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  const ms = end.getTime() - start.getTime();
  return Math.max(0, ms / (1000 * 60 * 60));
}

export type Period = 'today' | 'this-week' | 'this-month' | 'all';

export interface Window {
  start: string;
  end: string;
}

export function windowForPeriod(period: Period, now: Date = new Date()): Window | null {
  if (isNaN(now.getTime())) return null;
  if (period === 'all') return null;
  if (period === 'today') {
    return { start: getLocalDateString(now), end: getLocalDateString(now) };
  }
  if (period === 'this-week') {
    const mondayStr = getLocalWeekMondayString(now);
    const monday = new Date(mondayStr + 'T00:00:00');
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start: mondayStr, end: getLocalDateString(sunday) };
  }
  if (period === 'this-month') {
    const monthStr = getLocalMonthString(now);
    const year = now.getFullYear();
    const month = now.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    return {
      start: `${monthStr}-01`,
      end: `${monthStr}-${String(lastDay).padStart(2, '0')}`,
    };
  }
  return null;
}

export function filterByPeriod(
  entries: TimeEntry[],
  period: Period,
  now: Date = new Date()
): TimeEntry[] {
  if (period === 'all') {
    return entries.filter((e) => {
      const d = new Date(e.start_date);
      return !isNaN(d.getTime());
    });
  }

  const window = windowForPeriod(period, now);
  if (!window) return [];

  return entries.filter((e) => {
    const d = new Date(e.start_date);
    if (isNaN(d.getTime())) return false;
    const key = getLocalDateString(d);
    return key >= window.start && key <= window.end;
  });
}
