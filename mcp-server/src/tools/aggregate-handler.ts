import { apiCall } from '../services/api-client.js';
import type { Config, StructuredTimerResult } from '../types.js';
import type { AggregateInput } from '../schemas.js';
import { ResponseFormat } from '../types.js';
import { MAX_STATS_ENTRIES } from '../constants.js';
import {
  aggregateBy,
  formatAggregateText,
  formatAggregateJson,
  type TimeEntryRecordForAgg,
  type GroupBy,
} from './aggregate.js';

export async function qadrantAggregate(
  config: Config,
  input: AggregateInput
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

  const result = aggregateBy(entries, { by: input.by as GroupBy, period: input.period });

  const structured: StructuredTimerResult = {
    status: 'aggregate_computed',
    message: `Aggregated ${result.rows.length} group(s) by ${input.by}`,
    stats: {
      total_hours: result.total.hours,
      session_count: result.total.sessions,
      overall_count: totalCount,
    },
  };

  if (input.response_format === ResponseFormat.JSON) {
    return { text: formatAggregateJson(result), structured };
  }
  return { text: formatAggregateText(result), structured };
}
