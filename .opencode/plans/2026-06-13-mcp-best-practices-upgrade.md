# MCP Server Best Practices Upgrade Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the MCP server to match modern best practices: migrate from deprecated `Server`/`setRequestHandler` API to `McpServer`/`registerTool`, add tool annotations, structured outputs, proper pagination, response format switching, and restructure into focused files.

**Architecture:** Restructure `mcp-server/src/` into `tools/`, `services/`, and `schemas/`. Extract shared PocketBase API client and config reader from the monolith. Register all 5 tools via `McpServer.registerTool()` with Zod input schemas, annotations, output schemas, and `structuredContent` in responses.

**Tech Stack:** `@modelcontextprotocol/sdk` ^1.6.1, Zod ^3.23.8, TypeScript 5.3+, PocketBase REST API

---

### Task 1: Upgrade SDK and restructure project

**Files:**
- Modify: `mcp-server/package.json` (deps)
- Create: `mcp-server/src/types.ts`
- Create: `mcp-server/src/constants.ts`
- Create: `mcp-server/src/services/config.ts`
- Create: `mcp-server/src/services/api-client.ts`

- [ ] **Step 1: Update package.json dependencies**

Upgrade `@modelcontextprotocol/sdk` from `^0.6.0` to `^1.6.1`.

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.6.1",
    "zod": "^3.23.8"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
npm install
```
Expected: installs SDK 1.6.1+ without errors.

- [ ] **Step 3: Create shared types**

Create `mcp-server/src/types.ts`:

```typescript
export interface Config {
  pb_url: string;
  auth_token: string;
  user_id: string;
}

export interface TimeEntryRecord {
  id: string;
  space: string;
  specialization?: string;
  start_date: string;
  completion_time?: string;
}

export interface StructuredEntry {
  id: string;
  space: string;
  specialization: string;
  start_date: string;
  completion_time: string;
  duration_hours: number;
}

export interface StructuredTimerResult {
  status: string;
  message: string;
  data?: {
    id?: string;
    space?: string;
    specialization?: string;
    start_date?: string;
    elapsed_seconds?: number;
  };
  entries?: StructuredEntry[];
  stats?: {
    total_hours: number;
    session_count: number;
    overall_count: number;
  };
}

export enum ResponseFormat {
  MARKDOWN = 'markdown',
  JSON = 'json',
}
```

- [ ] **Step 4: Create constants**

Create `mcp-server/src/constants.ts`:

```typescript
export const CHARACTER_LIMIT = 25000;
export const DEFAULT_LIST_LIMIT = 10;
export const MAX_LIST_LIMIT = 100;
export const MAX_STATS_ENTRIES = 1000;
```

- [ ] **Step 5: Create config service**

Create `mcp-server/src/services/config.ts`:

```typescript
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import type { Config } from '../types.js';

const CONFIG_FILE = path.join(os.homedir(), '.qadrant', 'config.json');

export async function readConfig(): Promise<Config | null> {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}
```

- [ ] **Step 6: Create API client service**

Create `mcp-server/src/services/api-client.ts`:

```typescript
export async function apiCall(
  pbUrl: string,
  token: string,
  pathStr: string,
  options: RequestInit = {}
): Promise<unknown> {
  const headers: Record<string, string> = {
    Authorization: token,
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  const res = await fetch(`${pbUrl}${pathStr}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const error = new Error(`API error ${pathStr} (${res.status}): ${body}`);
    (error as Error & { status: number }).status = res.status;
    throw error;
  }

  return res.json();
}

export function handleApiError(error: unknown): string {
  if (error instanceof Error) {
    const status = (error as Error & { status?: number }).status;
    if (status === 404) {
      return 'Error: Resource not found. Please check the PocketBase URL is correct and the collection exists.';
    }
    if (status === 401 || status === 403) {
      return 'Error: Authentication failed. Please re-authenticate with: qadrant login <token>';
    }
    if (status === 429) {
      return 'Error: Rate limit exceeded. Please wait before making more requests.';
    }
    return `Error: ${error.message}`;
  }
  return `Error: Unexpected error occurred: ${String(error)}`;
}
```

- [ ] **Step 7: Commit**

```bash
git add mcp-server/package.json mcp-server/package-lock.json mcp-server/src/types.ts mcp-server/src/constants.ts mcp-server/src/services/config.ts mcp-server/src/services/api-client.ts
git commit -m "feat(mcp): upgrade SDK to 1.6.1, add types, constants, and shared services"
```

---

### Task 2: Create Zod schemas with strict validation

**Files:**
- Create: `mcp-server/src/schemas.ts`

- [ ] **Step 1: Create schemas file**

Create `mcp-server/src/schemas.ts`:

```typescript
import { z } from 'zod';
import { ResponseFormat, MAX_LIST_LIMIT } from './constants.js';

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
```

- [ ] **Step 2: Commit**

```bash
git add mcp-server/src/schemas.ts
git commit -m "feat(mcp): add Zod schemas with strict validation for all tools"
```

---

### Task 3: Timer tools — start_timer, stop_timer, get_active_timer

**Files:**
- Create: `mcp-server/src/tools/timer.ts`

- [ ] **Step 1: Create timer tools module**

Create `mcp-server/src/tools/timer.ts`:

```typescript
import { apiCall } from '../services/api-client.js';
import type { Config, StructuredEntry, StructuredTimerResult } from '../types.js';
import type { StartTimerInput, GetActiveTimerInput, StopTimerInput } from '../schemas.js';
import { ResponseFormat } from '../types.js';

export async function startTimer(
  config: Config,
  input: StartTimerInput
): Promise<{ text: string; structured: StructuredTimerResult }> {
  const { space, specialization = '' } = input;

  await apiCall(config.pb_url, config.auth_token, '/api/collections/time_entries/records', {
    method: 'POST',
    body: JSON.stringify({
      start_date: new Date().toISOString(),
      space,
      specialization,
      user: config.user_id,
    }),
  });

  const text = `TIMER_STARTED: Started tracking "${space}"` + (specialization ? ` // ${specialization}` : '');

  const structured: StructuredTimerResult = {
    status: 'timer_started',
    message: text,
    data: {
      space,
      specialization: specialization || undefined,
      start_date: new Date().toISOString(),
    },
  };

  return { text, structured };
}

export async function stopTimer(
  config: Config,
  _input: StopTimerInput
): Promise<{ text: string; structured: StructuredTimerResult }> {
  const filter = `user='${config.user_id}' && completion_time=""`;
  const checkUrl = `/api/collections/time_entries/records?filter=${encodeURIComponent(filter)}`;
  const activeResponse = await apiCall(config.pb_url, config.auth_token, checkUrl);
  const activeEntries = (activeResponse as { items?: Array<{ id: string; space: string; specialization?: string }> }).items || [];

  if (activeEntries.length === 0) {
    return {
      text: 'NO_ACTIVE_SESSION: There is no running timer to stop.',
      structured: { status: 'no_active_session', message: 'There is no running timer to stop.' },
    };
  }

  const stoppedEntries: Array<{ id: string; space: string; specialization: string }> = [];
  for (const entry of activeEntries) {
    await apiCall(config.pb_url, config.auth_token, `/api/collections/time_entries/records/${entry.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ completion_time: new Date().toISOString() }),
    });
    stoppedEntries.push({
      id: entry.id,
      space: entry.space,
      specialization: entry.specialization || '',
    });
  }

  const names = stoppedEntries.map((e) => `"${e.space}${e.specialization ? ' // ' + e.specialization : ''}"`).join(', ');
  const text = `TIMER_STOPPED: Successfully stopped active timer session for ${names}.`;

  const structured: StructuredTimerResult = {
    status: 'timer_stopped',
    message: text,
    entries: stoppedEntries.map((e) => ({
      id: e.id,
      space: e.space,
      specialization: e.specialization,
      start_date: '',
      completion_time: new Date().toISOString(),
      duration_hours: 0,
    })),
  };

  return { text, structured };
}

export async function getActiveTimer(
  config: Config,
  input: GetActiveTimerInput
): Promise<{ text: string; structured: StructuredTimerResult }> {
  const filter = `user='${config.user_id}' && completion_time=""`;
  const checkUrl = `/api/collections/time_entries/records?filter=${encodeURIComponent(filter)}`;
  const activeResponse = await apiCall(config.pb_url, config.auth_token, checkUrl);
  const activeEntries = (activeResponse as { items?: Array<{ id: string; space: string; specialization?: string; start_date: string }> }).items || [];

  if (activeEntries.length === 0) {
    return {
      text: 'NO_ACTIVE_SESSION',
      structured: { status: 'no_active_session', message: 'No running timers.' },
    };
  }

  const entries: StructuredEntry[] = activeEntries.map((entry) => {
    const elapsedSeconds = Math.floor((Date.now() - new Date(entry.start_date).getTime()) / 1000);
    return {
      id: entry.id,
      space: entry.space,
      specialization: entry.specialization || '',
      start_date: entry.start_date,
      completion_time: '',
      duration_hours: elapsedSeconds / 3600,
    };
  });

  if (input.response_format === ResponseFormat.JSON) {
    const structured: StructuredTimerResult = {
      status: 'active_timers',
      message: `${activeEntries.length} active timer(s)`,
      entries,
    };
    return { text: JSON.stringify(structured, null, 2), structured };
  }

  const lines = entries.map((e) => {
    const specDisplay = e.specialization ? ` // Sub: ${e.specialization}` : '';
    const elapsed = Math.round(e.duration_hours * 3600);
    return `- Active: Space: ${e.space}${specDisplay} running for ${elapsed} seconds.`;
  }).join('\n');

  return {
    text: `ACTIVE_TIMERS:\n${lines}`,
    structured: {
      status: 'active_timers',
      message: `${activeEntries.length} active timer(s)`,
      entries,
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add mcp-server/src/tools/timer.ts
git commit -m "feat(mcp): add timer tools with structured output and format switching"
```

---

### Task 4: Entries tool — list_entries with proper pagination

**Files:**
- Create: `mcp-server/src/tools/entries.ts`

- [ ] **Step 1: Create entries tool module**

Create `mcp-server/src/tools/entries.ts`:

```typescript
import { apiCall } from '../services/api-client.js';
import type { Config, StructuredEntry, StructuredTimerResult } from '../types.js';
import type { ListEntriesInput } from '../schemas.js';
import { ResponseFormat } from '../types.js';
import { CHARACTER_LIMIT } from '../constants.js';

export async function listEntries(
  config: Config,
  input: ListEntriesInput
): Promise<{ text: string; structured: StructuredTimerResult }> {
  const filter = `user='${config.user_id}' && completion_time!=""`;

  const url =
    `/api/collections/time_entries/records` +
    `?filter=${encodeURIComponent(filter)}` +
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
```

- [ ] **Step 2: Commit**

```bash
git add mcp-server/src/tools/entries.ts
git commit -m "feat(mcp): add list_entries with proper pagination"
```

---

### Task 5: Stats tool — get_stats with format switching and limits

**Files:**
- Create: `mcp-server/src/tools/stats.ts`

- [ ] **Step 1: Create stats tool module**

Create `mcp-server/src/tools/stats.ts`:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add mcp-server/src/tools/stats.ts
git commit -m "feat(mcp): add get_stats with format switching and entry limits"
```

---

### Task 6: Rewrite main entry point with McpServer + registerTool

**Files:**
- Rewrite: `mcp-server/src/index.ts`

- [ ] **Step 1: Rewrite index.ts with modern API**

Replace `mcp-server/src/index.ts` entirely:

```typescript
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
} from './schemas.js';
import type {
  StartTimerInput,
  ListEntriesInput,
  GetStatsInput,
  GetActiveTimerInput,
  StopTimerInput,
} from './schemas.js';
import { startTimer, stopTimer, getActiveTimer } from './tools/timer.js';
import { listEntries } from './tools/entries.js';
import { getStats } from './tools/stats.js';

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
    description: `Calculates cumulative tracked hours and displays total time analytics.

Aggregates duration across all completed time entries to compute total tracked hours.

Args:
  - response_format (string, optional): 'markdown' (default) or 'json'

Returns:
  For markdown: Total hours and session count.
  For json: Structured data with total_hours, session_count, overall_count.

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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Qadrant MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
```

- [ ] **Step 2: Build and verify compilation**

```bash
cd mcp-server && npm run build
```
Expected: successful compilation, no errors.

- [ ] **Step 3: Commit**

```bash
git add mcp-server/src/index.ts
git commit -m "feat(mcp): migrate to McpServer/registerTool with annotations and structured content"
```

---

### Task 7: Update tests for tool handlers

**Files:**
- Rewrite: `mcp-server/src/index.test.ts`

- [ ] **Step 1: Write replacement tests**

Rewrite `mcp-server/src/index.test.ts` entirely:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockReadFile = vi.fn();
vi.mock('fs/promises', () => ({
  default: { readFile: mockReadFile },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

import { readConfig } from './services/config.js';
import { apiCall } from './services/api-client.js';
import { startTimer, stopTimer, getActiveTimer } from './tools/timer.js';
import { listEntries } from './tools/entries.js';
import { getStats } from './tools/stats.js';
import type { Config } from './types.js';
import { ResponseFormat } from './types.js';

const makeConfig = (): Config => ({
  pb_url: 'http://localhost:8090',
  auth_token: 'test-token',
  user_id: 'user123',
});

describe('Config service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads valid config', async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify(makeConfig()));
    const config = await readConfig();
    expect(config?.pb_url).toBe('http://localhost:8090');
    expect(config?.auth_token).toBe('test-token');
    expect(config?.user_id).toBe('user123');
  });

  it('returns null for missing config', async () => {
    mockReadFile.mockRejectedValueOnce(new Error('ENOENT'));
    const config = await readConfig();
    expect(config).toBeNull();
  });
});

describe('apiCall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('makes a GET request and returns json', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [{ id: '1' }], totalItems: 1 }),
    });

    const data = await apiCall('http://localhost:8090', 'token', '/api/test');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8090/api/test',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'token' }),
      })
    );
    expect(data).toEqual({ items: [{ id: '1' }], totalItems: 1 });
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    });

    await expect(apiCall('http://localhost:8090', 'token', '/api/test')).rejects.toThrow('API error');
  });
});

describe('startTimer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a new timer entry', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'rec123', space: 'Work' }),
    });

    const result = await startTimer(makeConfig(), { space: 'Work' });
    expect(result.text).toContain('TIMER_STARTED');
    expect(result.text).toContain('Work');
    expect(result.structured.status).toBe('timer_started');
    expect(result.structured.data?.space).toBe('Work');
  });

  it('includes specialization in result', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'rec123', space: 'Work' }),
    });

    const result = await startTimer(makeConfig(), { space: 'Work', specialization: 'Coding' });
    expect(result.text).toContain('// Coding');
    expect(result.structured.data?.specialization).toBe('Coding');
  });
});

describe('stopTimer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns no active session when none running', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [] }),
    });

    const result = await stopTimer(makeConfig(), { response_format: ResponseFormat.MARKDOWN });
    expect(result.text).toContain('NO_ACTIVE_SESSION');
    expect(result.structured.status).toBe('no_active_session');
  });

  it('stops active timers', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [{ id: 'rec1', space: 'Work', specialization: 'Debug' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

    const result = await stopTimer(makeConfig(), { response_format: ResponseFormat.MARKDOWN });
    expect(result.text).toContain('TIMER_STOPPED');
    expect(result.text).toContain('Work');
    expect(result.structured.status).toBe('timer_stopped');
  });
});

describe('getActiveTimer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty when no active timers', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [] }),
    });

    const result = await getActiveTimer(makeConfig(), { response_format: ResponseFormat.MARKDOWN });
    expect(result.text).toBe('NO_ACTIVE_SESSION');
    expect(result.structured.status).toBe('no_active_session');
  });

  it('returns active timer with elapsed time in markdown format', async () => {
    const startDate = new Date(Date.now() - 60000).toISOString();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [{ id: 'rec1', space: 'Piano', start_date: startDate }] }),
    });

    const result = await getActiveTimer(makeConfig(), { response_format: ResponseFormat.MARKDOWN });
    expect(result.text).toContain('ACTIVE_TIMERS');
    expect(result.text).toContain('Piano');
    expect(result.structured.entries?.length).toBe(1);
  });

  it('returns active timer in json format', async () => {
    const startDate = new Date(Date.now() - 60000).toISOString();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [{ id: 'rec2', space: 'Work', start_date: startDate }] }),
    });

    const result = await getActiveTimer(makeConfig(), { response_format: ResponseFormat.JSON });
    expect(result.text).toContain('"status": "active_timers"');
    expect(result.structured.entries?.[0]?.space).toBe('Work');
  });
});

describe('listEntries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles empty result', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [], totalItems: 0 }),
    });

    const result = await listEntries(makeConfig(), { limit: 10, offset: 0, response_format: ResponseFormat.MARKDOWN });
    expect(result.text).toContain('No tracked time entry records found');
    expect(result.structured.entries?.length).toBe(0);
  });

  it('returns entries in markdown format', async () => {
    const now = new Date().toISOString();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [{ id: '1', space: 'Work', specialization: 'Coding', start_date: now, completion_time: now }],
        totalItems: 1,
      }),
    });

    const result = await listEntries(makeConfig(), { limit: 10, offset: 0, response_format: ResponseFormat.MARKDOWN });
    expect(result.text).toContain('RECENT_COMPLETED_ENTRIES');
    expect(result.text).toContain('Work');
    expect(result.text).toContain('Coding');
    expect(result.text).toContain('Showing all 1 entries');
  });

  it('returns pagination info when there are more entries', async () => {
    const now = new Date().toISOString();
    const items = Array.from({ length: 5 }, (_, i) => ({
      id: `${i}`,
      space: 'Work',
      start_date: now,
      completion_time: now,
    }));
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items, totalItems: 15 }),
    });

    const result = await listEntries(makeConfig(), { limit: 5, offset: 0, response_format: ResponseFormat.MARKDOWN });
    expect(result.text).toContain('Showing 5 of 15 entries');
    expect(result.text).toContain('next page');
  });

  it('returns entries in JSON format', async () => {
    const now = new Date().toISOString();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [{ id: '1', space: 'qadrant', start_date: now, completion_time: now }],
        totalItems: 1,
      }),
    });

    const result = await listEntries(makeConfig(), { limit: 10, offset: 0, response_format: ResponseFormat.JSON });
    expect(result.text).toContain('"status": "entries_listed"');
    const parsed = JSON.parse(result.text);
    expect(parsed.pagination.total).toBe(1);
    expect(parsed.entries[0].space).toBe('qadrant');
  });
});

describe('getStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns zero hours for empty entries', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [], totalItems: 0 }),
    });

    const result = await getStats(makeConfig(), { response_format: ResponseFormat.MARKDOWN });
    expect(result.text).toContain('0.00 hours');
    expect(result.structured.stats?.total_hours).toBe(0);
    expect(result.structured.stats?.session_count).toBe(0);
  });

  it('calculates total hours from completed entries', async () => {
    const start = new Date('2026-06-13T10:00:00Z').toISOString();
    const end = new Date('2026-06-13T12:00:00Z').toISOString();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [{ start_date: start, completion_time: end }],
        totalItems: 1,
      }),
    });

    const result = await getStats(makeConfig(), { response_format: ResponseFormat.MARKDOWN });
    expect(result.text).toContain('2.00 hours');
    expect(result.structured.stats?.total_hours).toBeCloseTo(2.0);
    expect(result.structured.stats?.session_count).toBe(1);
  });

  it('returns stats in JSON format', async () => {
    const start = new Date('2026-06-13T10:00:00Z').toISOString();
    const end = new Date('2026-06-13T11:30:00Z').toISOString();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [{ start_date: start, completion_time: end }],
        totalItems: 1,
      }),
    });

    const result = await getStats(makeConfig(), { response_format: ResponseFormat.JSON });
    const parsed = JSON.parse(result.text);
    expect(parsed.stats.total_hours).toBeCloseTo(1.5);
    expect(parsed.status).toBe('stats_computed');
  });
});
```

- [ ] **Step 2: Run tests**

```bash
cd mcp-server && npm test
```
Expected: all 16+ tests pass.

- [ ] **Step 3: Run build**

```bash
cd mcp-server && npm run build
```
Expected: successful compilation, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add mcp-server/src/index.test.ts
git commit -m "test(mcp): add comprehensive tests for all tool handlers and services"
```

---

### Task 8: Final verification and cleanup

**Files:**
- Verify: `mcp-server/dist/index.js` (exists after build)

- [ ] **Step 1: Full clean build**

```bash
cd mcp-server && rm -rf dist node_modules && npm install && npm run build
```
Expected: clean install, successful build.

- [ ] **Step 2: Run full test suite**

```bash
cd mcp-server && npm test
```
Expected: all tests pass.

- [ ] **Step 3: Run type check**

```bash
cd mcp-server && npx tsc --noEmit
```
Expected: no type errors.

- [ ] **Step 4: Verify new file structure**

```bash
ls -la mcp-server/src/ mcp-server/src/services/ mcp-server/src/tools/
```
Expected:
```
mcp-server/src/
  index.ts
  schemas.ts
  types.ts
  constants.ts
  services/
    config.ts
    api-client.ts
  tools/
    timer.ts
    entries.ts
    stats.ts
```

- [ ] **Step 5: Commit**

```bash
git add mcp-server/dist
git commit -m "chore(mcp): final build verification after restructure"
```
