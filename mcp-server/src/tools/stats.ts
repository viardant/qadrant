import { apiCall } from '../services/api-client.js';
import type { Config, StructuredTimerResult } from '../types.js';
import type { GetStatsInput } from '../schemas.js';
import { ResponseFormat } from '../types.js';
import { MAX_STATS_ENTRIES } from '../constants.js';

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
    items?: Array<{ start_date: string; completion_time: string }>;
    totalItems?: number;
  };

  const entries = response.items || [];
  const totalCount = response.totalItems ?? entries.length;

  let totalMs = 0;
  for (const entry of entries) {
    const start = new Date(entry.start_date).getTime();
    const end = new Date(entry.completion_time).getTime();
    totalMs += Math.max(0, end - start);
  }

  const totalHours = totalMs / (1000 * 60 * 60);
  const warning = totalCount > entries.length
    ? ` (analyzing your ${entries.length} most recent entries out of ${totalCount} total)`
    : '';

  if (input.response_format === ResponseFormat.JSON) {
    const structured: StructuredTimerResult = {
      status: 'stats_computed',
      message: `Total tracked hours: ${totalHours.toFixed(2)}`,
      stats: {
        total_hours: totalHours,
        session_count: entries.length,
        overall_count: totalCount,
      },
    };
    return {
      text: JSON.stringify(structured, null, 2),
      structured,
    };
  }

  const text = `TOTAL_TRACKED_HOURS: ${totalHours.toFixed(2)} hours tracked across ${entries.length} completed sessions${warning}.`;

  return {
    text,
    structured: {
      status: 'stats_computed',
      message: `Total tracked hours: ${totalHours.toFixed(2)}`,
      stats: {
        total_hours: totalHours,
        session_count: entries.length,
        overall_count: totalCount,
      },
    },
  };
}
