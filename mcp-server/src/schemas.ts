import { z } from 'zod';
import { ResponseFormat } from './types.js';
import { MAX_LIST_LIMIT, DEFAULT_STATS_LIMIT } from './constants.js';

export const StartTimerSchema = z.object({
  space: z
    .string()
    .min(1, 'Space name is required')
    .max(100, 'Space name must not exceed 100 characters')
    .describe('The space category to track time for (e.g. "Work", "Piano", "qadrant")'),
  specialization: z
    .string()
    .max(200, 'Specialization must not exceed 200 characters')
    .optional()
    .describe('Optional sub-level specialization or task detail (e.g. "Designing schema", "Scales")'),
}).strict();

export const ListEntriesSchema = z.object({
  space: z
    .string()
    .optional()
    .describe('Filter by space name (exact match)'),
  specialization: z
    .string()
    .optional()
    .describe('Filter by specialization (exact match)'),
  period: z
    .enum(['today', 'this-week', 'this-month', 'all'])
    .optional()
    .describe('Filter by preset time window'),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Start date YYYY-MM-DD (inclusive). Takes precedence over period.'),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('End date YYYY-MM-DD (inclusive). Takes precedence over period.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_LIST_LIMIT)
    .default(10)
    .describe('Maximum number of entries to return (1-100, default 10)'),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe('Number of entries to skip for pagination'),
  response_format: z
    .nativeEnum(ResponseFormat)
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable"),
}).strict();

export const GroupByEnum = z.enum(['space', 'combo', 'day', 'week', 'month']);
export const PeriodEnum = z.enum(['today', 'this-week', 'this-month', 'all']);

export const GetStatsSchema = z.object({
  by: GroupByEnum
    .optional()
    .describe('Group results by space|combo|day|week|month. Omit for the legacy single-number stats.'),
  period: PeriodEnum
    .default('all')
    .describe('Preset time window: today|this-week|this-month|all (default all). Ignored when from/to provided.'),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Custom start date YYYY-MM-DD (inclusive). Takes precedence over period.'),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Custom end date YYYY-MM-DD (inclusive). Takes precedence over period.'),
  space: z
    .string()
    .optional()
    .describe('Filter entries by space name (exact match)'),
  specialization: z
    .string()
    .optional()
    .describe('Filter entries by specialization (exact match)'),
  include_entries: z
    .boolean()
    .default(false)
    .describe('Include raw entry objects under each aggregate group row'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100000)
    .default(DEFAULT_STATS_LIMIT)
    .describe('Maximum number of entries to fetch for aggregation'),
  response_format: z
    .nativeEnum(ResponseFormat)
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable"),
}).strict();

// Deprecated — kept for backward compat, delegates to qadrant_get_stats
export const AggregateSchema = z.object({
  by: GroupByEnum
    .describe('Group results by space|combo|day|week|month'),
  period: PeriodEnum
    .default('all')
    .describe('Time window filter: today|this-week|this-month|all (default all)'),
  response_format: z
    .nativeEnum(ResponseFormat)
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable"),
}).strict();

export const GetActiveTimerSchema = z.object({
  response_format: z
    .nativeEnum(ResponseFormat)
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable"),
}).strict();

export const StopTimerSchema = z.object({
  response_format: z
    .nativeEnum(ResponseFormat)
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable"),
}).strict();

export type StartTimerInput = z.infer<typeof StartTimerSchema>;
export type ListEntriesInput = z.infer<typeof ListEntriesSchema>;
export type GetStatsInput = z.infer<typeof GetStatsSchema>;
export type AggregateInput = z.infer<typeof AggregateSchema>;
export type GetActiveTimerInput = z.infer<typeof GetActiveTimerSchema>;
export type StopTimerInput = z.infer<typeof StopTimerSchema>;
