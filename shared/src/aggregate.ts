import type { TimeEntry, GroupBy, Period, Window, AggregateRow, AggregateResult, AggregateOptions } from './types.js';
import { getLocalDateString, getLocalMonthString, getLocalWeekMondayString, getEntryDurationHours } from './date-helpers.js';

export function windowForPeriod(period: Period, now: Date = new Date()): Window | null {
  if (isNaN(now.getTime())) return null;
  if (period === 'all') return null;
  if (period === 'today') {
    return { start: getLocalDateString(now), end: getLocalDateString(now) };
  }
  if (period === 'yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const dateStr = getLocalDateString(yesterday);
    return { start: dateStr, end: dateStr };
  }
  if (period === 'this-week') {
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start: getLocalDateString(monday), end: getLocalDateString(sunday) };
  }
  if (period === 'last-week') {
    const d = new Date(now);
    const day = d.getDay();
    const diffToLastMonday = d.getDate() - day - 7 + (day === 0 ? -6 : 1);
    const lastMonday = new Date(now);
    lastMonday.setDate(diffToLastMonday);
    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);
    return { start: getLocalDateString(lastMonday), end: getLocalDateString(lastSunday) };
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
  if (period === 'last-month') {
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: getLocalDateString(lm), end: getLocalDateString(lastDay) };
  }
  if (period === 'last-30-days') {
    const d = new Date(now);
    d.setDate(now.getDate() - 30);
    return { start: getLocalDateString(d), end: getLocalDateString(now) };
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

export function filterByCustomRange(
  entries: TimeEntry[],
  from: string,
  to: string
): TimeEntry[] {
  return entries.filter((e) => {
    const d = new Date(e.start_date);
    if (isNaN(d.getTime())) return false;
    const key = getLocalDateString(d);
    return key >= from && key <= to;
  });
}

export function comboDisplayName(space: string, specialization: string): string {
  if (!specialization) return space || 'Untitled';
  if (!space) return specialization;
  return `${space} / ${specialization}`;
}

function groupKey(entry: TimeEntry, by: GroupBy): string | null {
  const d = new Date(entry.start_date);
  if (isNaN(d.getTime())) return null;
  const space = entry.space || 'No Space';
  switch (by) {
    case 'space': return space;
    case 'combo': return comboDisplayName(entry.space || '', entry.specialization || '');
    case 'day': return getLocalDateString(d);
    case 'week': return getLocalWeekMondayString(d);
    case 'month': return getLocalMonthString(d);
    case 'hour-of-day': return `${String(d.getHours()).padStart(2, '0')}:00`;
    case 'day-of-week': return d.toLocaleDateString('en-US', { weekday: 'long' });
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
    rows.push({ key, hours: Number(agg.hours.toFixed(2)), sessions: agg.sessions, share: 0 });
  }
  return rows;
}

export function aggregateBy(
  entries: TimeEntry[],
  options: AggregateOptions,
  now: Date = new Date()
): AggregateResult {
  let filtered = entries;

  if (options.space) {
    filtered = filtered.filter((e) => e.space === options.space);
  }

  if (options.specialization) {
    filtered = filtered.filter((e) => e.specialization === options.specialization);
  }

  let period: Period | 'custom';
  let window: Window | null;

  if (options.from && options.to) {
    filtered = filterByCustomRange(filtered, options.from, options.to);
    period = 'custom';
    window = { start: options.from, end: options.to };
  } else {
    const p: Period = options.period ?? 'all';
    filtered = filterByPeriod(filtered, p, now);
    period = p;
    window = windowForPeriod(p, now);
  }

  if (options.includeEntries) {
    const buckets = new Map<string, { hours: number; sessions: number; entries: TimeEntry[] }>();
    for (const entry of filtered) {
      const key = groupKey(entry, options.by);
      if (key === null) continue;
      const hours = getEntryDurationHours(entry);
      const existing = buckets.get(key) ?? { hours: 0, sessions: 0, entries: [] };
      existing.hours += hours;
      if (entry.completion_time) existing.sessions += 1;
      existing.entries.push(entry);
      buckets.set(key, existing);
    }

    const rows: AggregateRow[] = [];
    for (const [key, agg] of buckets) {
      rows.push({
        key,
        hours: Number(agg.hours.toFixed(2)),
        sessions: agg.sessions,
        share: 0,
        entries: agg.entries,
      });
    }

    const totalHours = rows.reduce((s, r) => s + r.hours, 0);
    const totalSessions = rows.reduce((s, r) => s + r.sessions, 0);

    for (const row of rows) {
      row.share = totalHours > 0 ? Number((row.hours / totalHours).toFixed(4)) : 0;
    }

    rows.sort((a, b) => b.hours - a.hours || a.key.localeCompare(b.key));

    return {
      by: options.by,
      period,
      window,
      rows,
      total: { hours: Number(totalHours.toFixed(2)), sessions: totalSessions },
    };
  }

  const grouped = groupBy(filtered, options.by);
  const totalHours = grouped.reduce((s, r) => s + r.hours, 0);
  const totalSessions = grouped.reduce((s, r) => s + r.sessions, 0);

  const rows: AggregateRow[] = grouped.map((r) => ({
    ...r,
    share: totalHours > 0 ? Number((r.hours / totalHours).toFixed(4)) : 0,
  }));

  rows.sort((a, b) => b.hours - a.hours || a.key.localeCompare(b.key));

  return {
    by: options.by,
    period,
    window,
    rows,
    total: { hours: Number(totalHours.toFixed(2)), sessions: totalSessions },
  };
}

const MAX_KEY_WIDTH = 32;

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

function padLeft(s: string, n: number): string {
  return s.length >= n ? s : ' '.repeat(n - s.length) + s;
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
    pad('KEY', keyWidth) + '  ' +
    padLeft('HOURS', 7) + '  ' +
    padLeft('SESSIONS', 8) + '  ' +
    padLeft('SHARE', 7);
  const rule = '-'.repeat(header.length);
  lines.push(rule);
  lines.push(header);
  lines.push(rule);
  for (const row of result.rows) {
    lines.push(
      pad(truncate(row.key, MAX_KEY_WIDTH), keyWidth) + '  ' +
      padLeft(row.hours.toFixed(2), 7) + '  ' +
      padLeft(String(row.sessions), 8) + '  ' +
      padLeft((row.share * 100).toFixed(1) + '%', 7)
    );
  }
  lines.push(rule);
  lines.push(
    pad('TOTAL', keyWidth) + '  ' +
    padLeft(result.total.hours.toFixed(2), 7) + '  ' +
    padLeft(String(result.total.sessions), 8) + '  ' +
    padLeft('100.0%', 7)
  );
  return lines.join('\n');
}

export function formatAggregateJson(result: AggregateResult): string {
  return JSON.stringify(result, null, 2);
}
