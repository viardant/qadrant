import { apiCall } from '../services/api-client.js';
import type { Config, StructuredEntry, StructuredTimerResult } from '../types.js';
import type { ListEntriesInput } from '../schemas.js';
import { ResponseFormat } from '../types.js';
import { CHARACTER_LIMIT } from '../constants.js';

export async function listEntries(
  config: Config,
  input: ListEntriesInput
): Promise<{ text: string; structured: StructuredTimerResult }> {
  const filters: string[] = [`user='${config.user_id}'`, `completion_time!=""`];
  if (input.space) filters.push(`space='${input.space}'`);
  if (input.specialization) filters.push(`specialization='${input.specialization}'`);
  if (input.from) filters.push(`start_date>='${input.from}T00:00:00'`);
  if (input.to) filters.push(`start_date<='${input.to}T23:59:59'`);

  const filterStr = encodeURIComponent(filters.join(' && '));
  const url =
    `/api/collections/time_entries/records` +
    `?filter=${filterStr}` +
    `&sort=-start_date` +
    `&perPage=${input.limit}` +
    `&page=${Math.floor(input.offset / input.limit) + 1}`;

  const response = (await apiCall(config.pb_url, config.auth_token, url)) as {
    items?: Array<{ id: string; space: string; specialization?: string; start_date: string; completion_time?: string }>;
    totalItems?: number;
  };

  const rawEntries = response.items || [];
  const totalCount = response.totalItems ?? rawEntries.length;

  if (rawEntries.length === 0) {
    return {
      text: 'No tracked time entry records found.',
      structured: {
        status: 'no_entries',
        message: 'No tracked time entry records found.',
        entries: [],
        stats: { total_hours: 0, session_count: 0, overall_count: 0 },
      },
    };
  }

  const entries: StructuredEntry[] = rawEntries.map((e) => {
    const start = new Date(e.start_date).getTime();
    const end = e.completion_time ? new Date(e.completion_time).getTime() : start;
    return {
      id: e.id,
      space: e.space,
      specialization: e.specialization || '',
      start_date: e.start_date,
      completion_time: e.completion_time || '',
      duration_hours: Math.max(0, end - start) / (1000 * 60 * 60),
    };
  });

  const hasMore = input.offset + input.limit < totalCount;
  const nextOffset = hasMore ? input.offset + input.limit : undefined;

  const structured: StructuredTimerResult = {
    status: 'entries_listed',
    message: `Found ${totalCount} total entries (showing ${entries.length})`,
    entries,
    stats: {
      total_hours: entries.reduce((sum, e) => sum + e.duration_hours, 0),
      session_count: entries.length,
      overall_count: totalCount,
    },
  };

  if (input.response_format === ResponseFormat.JSON) {
    const jsonOutput = JSON.stringify(
      {
        ...structured,
        pagination: {
          total: totalCount,
          offset: input.offset,
          limit: input.limit,
          has_more: hasMore,
          next_offset: nextOffset,
        },
      },
      null,
      2
    );
    return { text: jsonOutput, structured };
  }

  let formatted = entries
    .map((e) => {
      return `- [${new Date(e.start_date).toLocaleDateString()}] (${e.duration_hours.toFixed(2)}h) Space: ${e.space} // Sub: ${e.specialization}`;
    })
    .join('\n');

  const paginationInfo = hasMore
    ? `\n\nShowing ${entries.length} of ${totalCount} entries. Use offset=${nextOffset} for the next page.`
    : `\n\nShowing all ${totalCount} entries.`;

  let text = `RECENT_COMPLETED_ENTRIES:\n${formatted}${paginationInfo}`;

  if (text.length > CHARACTER_LIMIT) {
    text = text.slice(0, CHARACTER_LIMIT) + `\n\n[Response truncated at ${CHARACTER_LIMIT} characters. Use a smaller limit or response_format=json for full data.]`;
  }

  return { text, structured };
}
