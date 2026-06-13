import { z } from 'zod';
import { ResponseFormat } from './types.js';
import { MAX_LIST_LIMIT } from './constants.js';

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

export const GetStatsSchema = z.object({
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
export type GetActiveTimerInput = z.infer<typeof GetActiveTimerSchema>;
export type StopTimerInput = z.infer<typeof StopTimerSchema>;
