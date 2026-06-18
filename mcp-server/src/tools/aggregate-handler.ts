import { getStats } from './stats.js';
import type { Config, StructuredTimerResult } from '../types.js';
import type { AggregateInput, GetStatsInput } from '../schemas.js';

export async function qadrantAggregate(
  config: Config,
  input: AggregateInput
): Promise<{ text: string; structured: StructuredTimerResult }> {
  const statsInput: GetStatsInput = {
    by: input.by,
    period: input.period,
    limit: 10000,
    response_format: input.response_format,
  };

  const result = await getStats(config, statsInput);

  return {
    text: `[Deprecated: use qadrant_get_stats instead]\n\n${result.text}`,
    structured: {
      ...result.structured,
      status: 'aggregate_computed',
      message: `[Deprecated] ${result.structured.message}`,
    },
  };
}
