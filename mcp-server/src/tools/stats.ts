import { apiCall } from '../services/api-client.js';
import type { Config, StructuredTimerResult } from '../types.js';
import type { GetStatsInput } from '../schemas.js';
import { ResponseFormat } from '../types.js';
import { MAX_STATS_ENTRIES } from '../constants.js';
import {
  aggregateBy,
  formatAggregateText,
  formatAggregateJson,
  type TimeEntryRecordForAgg,
  type GroupBy,
} from './aggregate.js';

export async function getStats(
  config: Config,
  input: GetStatsInput
): Promise<{ text: string; structured: StructuredTimerResult }> {
  const filter = `user='${config.user_id}' && completion_time!=""`;
  const url =
    `/api/collections/time_entries/records` +
    `?filter=${encodeURIComponent(filter)}` +
    `&perPage=${MAX_STATS_ENTRIES}` +
    `&sort=-start_date`;

  const response = (await apiCall(config.pb_url, config.auth_token, url)) as {
    items?: Array<{ id: string; space: string; specialization?: string; start_date: string; completion_time: string }>;
    totalItems?: number;
  };

  const rawEntries = response.items || [];
  const totalCount = response.totalItems ?? rawEntries.length;
  const entries: TimeEntryRecordForAgg[] = rawEntries
    .filter((e) => e.completion_time)
    .map((e) => ({
      id: e.id,
      space: e.space || '',
      specialization: e.specialization || '',
      start_date: e.start_date,
      completion_time: e.completion_time,
    }));

  if (input.by) {
    const result = aggregateBy(entries, { by: input.by as GroupBy, period: input.period });
    if (input.response_format === ResponseFormat.JSON) {
      const json = formatAggregateJson(result);
      const structured: StructuredTimerResult = {
        status: 'stats_aggregated',
        message: `Aggregated ${result.rows.length} group(s) by ${input.by}`,
        stats: {
          total_hours: result.total.hours,
          session_count: result.total.sessions,
          overall_count: totalCount,
        },
      };
      return { text: json, structured };
    }
    const text = formatAggregateText(result);
    const structured: StructuredTimerResult = {
      status: 'stats_aggregated',
      message: `Aggregated ${result.rows.length} group(s) by ${input.by}`,
      stats: {
        total_hours: result.total.hours,
        session_count: result.total.sessions,
        overall_count: totalCount,
      },
    };
    return { text, structured };
  }

  // Legacy no-by path — unchanged.
  let totalMs = 0;
  for (const entry of rawEntries) {
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
    return {
      text: JSON.stringify(structured, null, 2),
      structured,
    };
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
