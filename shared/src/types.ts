export interface TimeEntry {
  id: string;
  space: string;
  specialization: string;
  start_date: string;
  completion_time: string | null;
  user: string;
}

export type GroupBy = 'space' | 'combo' | 'day' | 'week' | 'month' | 'hour-of-day' | 'day-of-week';
export type Period = 'today' | 'this-week' | 'this-month' | 'all' | 'yesterday' | 'last-week' | 'last-month' | 'last-30-days';

export interface Window {
  start: string;
  end: string;
}

export interface AggregateRow {
  key: string;
  hours: number;
  sessions: number;
  share: number;
  entries?: TimeEntry[];
}

export interface AggregateResult {
  by: GroupBy;
  period: Period | 'custom';
  window: Window | null;
  rows: AggregateRow[];
  total: { hours: number; sessions: number };
}

export interface AggregateOptions {
  by: GroupBy;
  period?: Period;
  from?: string;
  to?: string;
  space?: string;
  specialization?: string;
  includeEntries?: boolean;
}
