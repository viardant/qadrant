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

export type GroupBy = 'space' | 'combo' | 'day' | 'week' | 'month';

export function comboDisplayName(space: string, specialization: string): string {
  if (!specialization) return space || 'Untitled';
  if (!space) return specialization;
  return `${space} / ${specialization}`;
}

export interface AggregateRow {
  key: string;
  hours: number;
  sessions: number;
}

function groupKey(entry: TimeEntry, by: GroupBy): string | null {
  const d = new Date(entry.start_date);
  if (isNaN(d.getTime())) return null;
  const space = entry.space || 'No Space';
  switch (by) {
    case 'space':
      return space;
    case 'combo':
      return comboDisplayName(entry.space || '', entry.specialization || '');
    case 'day':
      return getLocalDateString(d);
    case 'week':
      return getLocalWeekMondayString(d);
    case 'month':
      return getLocalMonthString(d);
  }
}

export function groupBy(entries: TimeEntry[], by: GroupBy): AggregateRow[] {
  const buckets = new Map<string, { hours: number; sessions: number }>();
  for (const entry of entries) {
    const key = groupKey(entry, by);
    if (key === null) continue;
    const hours = getEntryDurationHours(entry);
    const existing = buckets.get(key) ?? { hours: 0, sessions: 0 };
    existing.hours += hours;
    if (entry.completion_time) existing.sessions += 1;
    buckets.set(key, existing);
  }
  const rows: AggregateRow[] = [];
  for (const [key, agg] of buckets) {
    rows.push({
      key,
      hours: Number(agg.hours.toFixed(2)),
      sessions: agg.sessions,
    });
  }
  return rows;
}

export interface AggregateResult {
  by: GroupBy;
  period: Period;
  window: Window | null;
  rows: Array<AggregateRow & { share: number }>;
  total: { hours: number; sessions: number };
}

export interface AggregateOptions {
  by: GroupBy;
  period?: Period;
}

export function aggregateBy(
  entries: TimeEntry[],
  options: AggregateOptions,
  now: Date = new Date()
): AggregateResult {
  const period: Period = options.period ?? 'all';
  const filtered = filterByPeriod(entries, period, now);
  const rows = groupBy(filtered, options.by);
  const totalHours = rows.reduce((s, r) => s + r.hours, 0);
  const totalSessions = rows.reduce((s, r) => s + r.sessions, 0);
  const enriched = rows.map((r) => ({
    ...r,
    share: totalHours > 0 ? Number((r.hours / totalHours).toFixed(4)) : 0,
  }));
  enriched.sort((a, b) => b.hours - a.hours || a.key.localeCompare(b.key));
  return {
    by: options.by,
    period,
    window: windowForPeriod(period, now),
    rows: enriched,
    total: {
      hours: Number(totalHours.toFixed(2)),
      sessions: totalSessions,
    },
  };
}

const MAX_KEY_WIDTH = 32;

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

function pad(s: string, n: number): string {
  if (s.length >= n) return s;
  return s + ' '.repeat(n - s.length);
}

function padLeft(s: string, n: number): string {
  if (s.length >= n) return s;
  return ' '.repeat(n - s.length) + s;
}

export function formatAggregateText(result: AggregateResult): string {
  const dimensionLabel = result.by.toUpperCase();
  const periodLabel = result.period.toUpperCase();
  const lines: string[] = [];
  lines.push(`DIMENSION: ${dimensionLabel}`);
  lines.push(`PERIOD:    ${periodLabel}`);
  if (result.window) {
    lines.push(`WINDOW:    ${result.window.start}..${result.window.end}`);
  }
  lines.push('');

  if (result.rows.length === 0) {
    lines.push('NO_DATA');
    return lines.join('\n');
  }

  const keyWidth = Math.min(
    MAX_KEY_WIDTH,
    Math.max(3, ...result.rows.map((r) => truncate(r.key, MAX_KEY_WIDTH).length))
  );
  const header =
    pad('KEY', keyWidth) +
    '  ' +
    padLeft('HOURS', 7) +
    '  ' +
    padLeft('SESSIONS', 8) +
    '  ' +
    padLeft('SHARE', 7);
  const rule = '-'.repeat(header.length);
  lines.push(rule);
  lines.push(header);
  lines.push(rule);
  for (const row of result.rows) {
    lines.push(
      pad(truncate(row.key, MAX_KEY_WIDTH), keyWidth) +
        '  ' +
        padLeft(row.hours.toFixed(2), 7) +
        '  ' +
        padLeft(String(row.sessions), 8) +
        '  ' +
        padLeft((row.share * 100).toFixed(1) + '%', 7)
    );
  }
  lines.push(rule);
  lines.push(
    pad('TOTAL', keyWidth) +
      '  ' +
      padLeft(result.total.hours.toFixed(2), 7) +
      '  ' +
      padLeft(String(result.total.sessions), 8) +
      '  ' +
      padLeft('100.0%', 7)
  );
  return lines.join('\n');
}

export function formatAggregateJson(result: AggregateResult): string {
  return JSON.stringify(result, null, 2);
}
