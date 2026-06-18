import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readConfig } from './services/config.js';
import { handleApiError } from './services/api-client.js';
import {
  StartTimerSchema,
  ListEntriesSchema,
  GetStatsSchema,
  GetActiveTimerSchema,
  StopTimerSchema,
  AggregateSchema,
} from './schemas.js';
import type {
  StartTimerInput,
  ListEntriesInput,
  GetStatsInput,
  GetActiveTimerInput,
  StopTimerInput,
  AggregateInput,
} from './schemas.js';
import { startTimer, stopTimer, getActiveTimer } from './tools/timer.js';
import { listEntries } from './tools/entries.js';
import { getStats } from './tools/stats.js';
import { qadrantAggregate } from './tools/aggregate-handler.js';

const server = new McpServer({
  name: 'qadrant-mcp-server',
  version: '1.0.0',
});

server.registerTool(
  'qadrant_start_timer',
  {
    title: 'Start Timer',
    description: `Starts a new active time tracking timer for a space.

Creates a new time entry record with the current timestamp as start_date. If another timer is already running, this will start a second concurrent timer (multiple timers can run simultaneously).

Args:
  - space (string, required): The space category to track (e.g. "Work", "Piano", "qadrant")
  - specialization (string, optional): Sub-category or task detail (e.g. "Designing schema", "Scales")

Returns:
  TIMER_STARTED: Started tracking "<space>" or similar status message.
  Structured output includes the created entry's space, specialization, and start_date.

Error Handling:
  - Returns auth error if not logged in (use "qadrant login <token>" first)
  - Returns API error if PocketBase is unreachable`,
    inputSchema: StartTimerSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  async (input: StartTimerInput) => {
    const config = await readConfig();
    if (!config) {
      return {
        content: [{ type: 'text', text: 'Error: Not authenticated. Please login first: qadrant login <token>' }],
        isError: true,
      };
    }

    try {
      const result = await startTimer(config, input);
      return {
        content: [{ type: 'text', text: result.text }],
        structuredContent: result.structured,
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: handleApiError(err) }],
        isError: true,
      };
    }
  }
);

server.registerTool(
  'qadrant_stop_timer',
  {
    title: 'Stop Timer',
    description: `Stops all currently running active time tracker timers.

Finds all time entries with no completion_time and sets their completion_time to the current timestamp.

Returns:
  TIMER_STOPPED: Successfully stopped active timer session for "<space>".
  NO_ACTIVE_SESSION: There is no running timer to stop.

Error Handling:
  - Returns auth error if not logged in`,
    inputSchema: StopTimerSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  async (input: StopTimerInput) => {
    const config = await readConfig();
    if (!config) {
      return {
        content: [{ type: 'text', text: 'Error: Not authenticated. Please login first: qadrant login <token>' }],
        isError: true,
      };
    }

    try {
      const result = await stopTimer(config, input);
      return {
        content: [{ type: 'text', text: result.text }],
        structuredContent: result.structured,
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: handleApiError(err) }],
        isError: true,
      };
    }
  }
);

server.registerTool(
  'qadrant_get_active_timer',
  {
    title: 'Get Active Timer',
    description: `Retrieves all currently running active timer sessions with elapsed time.

Args:
  - response_format (string, optional): 'markdown' (default) or 'json'

Returns:
  For markdown: List of active timers with elapsed seconds.
  For json: Structured data with entries array containing id, space, specialization, start_date, duration_hours.

Error Handling:
  - Returns auth error if not logged in`,
    inputSchema: GetActiveTimerSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async (input: GetActiveTimerInput) => {
    const config = await readConfig();
    if (!config) {
      return {
        content: [{ type: 'text', text: 'Error: Not authenticated. Please login first: qadrant login <token>' }],
        isError: true,
      };
    }

    try {
      const result = await getActiveTimer(config, input);
      return {
        content: [{ type: 'text', text: result.text }],
        structuredContent: result.structured,
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: handleApiError(err) }],
        isError: true,
      };
    }
  }
);

server.registerTool(
  'qadrant_list_entries',
  {
    title: 'List Entries',
    description: `Retrieves a list of recent completed time tracking logs with pagination.

Args:
  - limit (number, optional): Max entries to return (1-100, default 10)
  - offset (number, optional): Number of entries to skip for pagination (default 0)
  - response_format (string, optional): 'markdown' (default) or 'json'

Returns:
  For markdown: Formatted list with date, duration, space, specialization.
  For json: Structured data with entries array, pagination info (total, offset, limit, has_more, next_offset), and stats.

Error Handling:
  - Returns auth error if not logged in`,
    inputSchema: ListEntriesSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async (input: ListEntriesInput) => {
    const config = await readConfig();
    if (!config) {
      return {
        content: [{ type: 'text', text: 'Error: Not authenticated. Please login first: qadrant login <token>' }],
        isError: true,
      };
    }

    try {
      const result = await listEntries(config, input);
      return {
        content: [{ type: 'text', text: result.text }],
        structuredContent: result.structured,
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: handleApiError(err) }],
        isError: true,
      };
    }
  }
);

server.registerTool(
  'qadrant_get_stats',
  {
    title: 'Get Stats',
    description: `Calculates cumulative tracked hours and displays total time analytics. Optionally groups results by a chosen dimension.

Aggregates duration across all completed time entries to compute total tracked hours. When 'by' is provided, returns a grouped table instead of the legacy single-number total.

Args:
  - by (string, optional): "space" | "combo" | "day" | "week" | "month". Omit for the legacy single-number stats.
  - period (string, optional): "today" | "this-week" | "this-month" | "all" (default "all").
  - response_format (string, optional): 'markdown' (default) or 'json'.

Returns:
  For markdown (no 'by'): Total hours and session count.
  For markdown (with 'by'): A grouped table with KEY/HOURS/SESSIONS/SHARE.
  For json: Structured payload (single-number or grouped depending on 'by').

Note: If you have more than 1000 entries, stats are computed from the most recent 1000.

Error Handling:
  - Returns auth error if not logged in`,
    inputSchema: GetStatsSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async (input: GetStatsInput) => {
    const config = await readConfig();
    if (!config) {
      return {
        content: [{ type: 'text', text: 'Error: Not authenticated. Please login first: qadrant login <token>' }],
        isError: true,
      };
    }

    try {
      const result = await getStats(config, input);
      return {
        content: [{ type: 'text', text: result.text }],
        structuredContent: result.structured,
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: handleApiError(err) }],
        isError: true,
      };
    }
  }
);

server.registerTool(
  'qadrant_aggregate',
  {
    title: 'Aggregate Time Entries',
    description: `Aggregates completed time entries by a chosen dimension over a preset time window.

Useful for the agent to answer questions like "how many hours did I spend on Work this month?" or "what is my distribution across spaces this week?" without fetching raw entries and computing on the fly.

Args:
  - by (string, required): Group dimension. One of "space" | "combo" | "day" | "week" | "month".
  - period (string, optional): Time window. One of "today" | "this-week" | "this-month" | "all". Default "all".
  - response_format (string, optional): 'markdown' (default) or 'json'.

Returns:
  For markdown: a DIMENSION/PERIOD/WINDOW header followed by a KEY/HOURS/SESSIONS/SHARE table and a TOTAL row.
  For json: the structured envelope { by, period, window, rows: [{key, hours, sessions, share}], total: {hours, sessions} }.

Error Handling:
  - Returns auth error if not logged in
  - Returns API error if PocketBase is unreachable`,
    inputSchema: AggregateSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async (input: AggregateInput) => {
    const config = await readConfig();
    if (!config) {
      return {
        content: [{ type: 'text', text: 'Error: Not authenticated. Please login first: qadrant login <token>' }],
        isError: true,
      };
    }

    try {
      const result = await qadrantAggregate(config, input);
      return {
        content: [{ type: 'text', text: result.text }],
        structuredContent: result.structured,
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: handleApiError(err) }],
        isError: true,
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Qadrant MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
