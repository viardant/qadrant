import { apiCall } from '../services/api-client.js';
import type { Config, StructuredEntry, StructuredTimerResult } from '../types.js';
import type { GetStatsInput } from '../schemas.js';
import { ResponseFormat } from '../types.js';
import { DEFAULT_STATS_LIMIT } from '../constants.js';
import {
  aggregateBy,
  formatAggregateText,
  formatAggregateJson,
  type GroupBy,
  type TimeEntry,
} from '../../../shared/src/index.js';

export async function getStats(
  config: Config,
  input: GetStatsInput
): Promise<{ text: string; structured: StructuredTimerResult }> {
  const filters: string[] = [`user='${config.user_id}'`, `completion_time!=""`];
  if (input.space) filters.push(`space='${input.space}'`);
  if (input.specialization) filters.push(`specialization='${input.specialization}'`);

  const filterStr = encodeURIComponent(filters.join(' && '));
  const limit = input.limit ?? DEFAULT_STATS_LIMIT;
  const includeEntries = input.include_entries ?? false;

  const url =
    `/api/collections/time_entries/records` +
    `?filter=${filterStr}` +
    `&perPage=${limit}` +
    `&sort=-start_date`;

  const response = (await apiCall(config.pb_url, config.auth_token, url)) as {
    items?: Array<{ id: string; space: string; specialization?: string; start_date: string; completion_time: string }>;
    totalItems?: number;
  };

  const rawEntries = response.items || [];
  const totalCount = response.totalItems ?? rawEntries.length;

  const entries: TimeEntry[] = rawEntries
    .filter((e) => e.completion_time)
    .map((e) => ({
      id: e.id,
      space: e.space || '',
      specialization: e.specialization || '',
      start_date: e.start_date,
      completion_time: e.completion_time,
      user: config.user_id,
    }));

  if (input.by) {
    const result = aggregateBy(entries, {
      by: input.by as GroupBy,
      period: input.period,
      from: input.from,
      to: input.to,
      space: input.space,
      specialization: input.specialization,
      includeEntries,
    });

    const aggregateRows = result.rows.map((row) => ({
      key: row.key,
      hours: row.hours,
      sessions: row.sessions,
      share: row.share,
      entries: row.entries?.map((e: TimeEntry): StructuredEntry => ({
        id: e.id,
        space: e.space,
        specialization: e.specialization,
        start_date: e.start_date,
        completion_time: e.completion_time ?? '',
        duration_hours: e.completion_time
          ? (new Date(e.completion_time).getTime() - new Date(e.start_date).getTime()) / (1000 * 60 * 60)
          : 0,
      })),
    }));

    const structured: StructuredTimerResult = {
      status: 'stats_aggregated',
      message: `Aggregated ${result.rows.length} group(s) by ${input.by}`,
      stats: {
        total_hours: result.total.hours,
        session_count: result.total.sessions,
        overall_count: totalCount,
      },
      aggregate: {
        by: result.by,
        period: result.period,
        window: result.window,
        rows: aggregateRows,
        total: result.total,
      },
    };

    if (input.response_format === ResponseFormat.JSON) {
      return { text: JSON.stringify(structured, null, 2), structured };
    }
    return { text: formatAggregateText(result), structured };
  }

  // Legacy no-by path
  let totalMs = 0;
  for (const entry of rawEntries) {
    if (!entry.completion_time) continue;
    const start = new Date(entry.start_date).getTime();
    const end = new Date(entry.completion_time).getTime();
    totalMs += Math.max(0, end - start);
  }

  const totalHours = totalMs / (1000 * 60 * 60);
  const warning = totalCount > rawEntries.length
    ? ` (analyzing your ${rawEntries.length} most recent entries out of ${totalCount} total)`
    : '';

  if (input.response_format === ResponseFormat.JSON) {
    const structured: StructuredTimerResult = {
      status: 'stats_computed',
      message: `Total tracked hours: ${totalHours.toFixed(2)}`,
      stats: {
        total_hours: totalHours,
        session_count: rawEntries.length,
        overall_count: totalCount,
      },
    };
    return { text: JSON.stringify(structured, null, 2), structured };
  }

  const text = `TOTAL_TRACKED_HOURS: ${totalHours.toFixed(2)} hours tracked across ${rawEntries.length} completed sessions${warning}.`;
  return {
    text,
    structured: {
      status: 'stats_computed',
      message: `Total tracked hours: ${totalHours.toFixed(2)}`,
      stats: {
        total_hours: totalHours,
        session_count: rawEntries.length,
        overall_count: totalCount,
      },
    },
  };
}
