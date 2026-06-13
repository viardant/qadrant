import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';

const CONFIG_FILE = path.join(os.homedir(), '.qadrant', 'config.json');

interface Config {
  pb_url: string;
  auth_token: string;
  user_id: string;
}

interface TimeEntryRecord {
  id: string;
  space: string;
  specialization?: string;
  start_date: string;
  completion_time?: string;
}

async function readConfig(): Promise<Config | null> {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function apiCall(pbUrl: string, token: string, pathStr: string, options: RequestInit = {}): Promise<unknown> {
  const headers = {
    'Authorization': token,
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  const res = await fetch(`${pbUrl}${pathStr}`, {
    ...options,
    headers
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API error ${pathStr} (${res.status}): ${body}`);
  }
  return res.json();
}

// Instantiate server
const server = new Server(
  {
    name: 'qadrant-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register list tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'qadrant_start_timer',
        description: 'Starts a new active time tracking timer for a space.',
        inputSchema: {
          type: 'object',
          properties: {
            space: {
              type: 'string',
              description: 'The space category to track time for (e.g. "Work", "Piano", "qadrant")',
            },
            specialization: {
              type: 'string',
              description: 'Optional sub-level specialization or task detail within the space (e.g. "Designing schema", "Scales")',
            },
          },
          required: ['space'],
        },
      },
      {
        name: 'qadrant_stop_timer',
        description: 'Stops all currently running active time tracker timers.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'qadrant_get_active_timer',
        description: 'Retrieves all currently running active timer sessions.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'qadrant_list_entries',
        description: 'Retrieves a list of recent completed time tracking logs.',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of entries to return (default is 10)',
            },
          },
        },
      },
      {
        name: 'qadrant_get_stats',
        description: 'Calculates the cumulative tracked hours and displays total time analytics.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Call tool schemas Zod validators
const StartTimerSchema = z.object({
  space: z.string(),
  specialization: z.string().optional(),
});

const ListEntriesSchema = z.object({
  limit: z.number().optional(),
});

// Register call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const config = await readConfig();
  if (!config) {
    return {
      content: [
        {
          type: 'text',
          text: 'Error: Not authenticated. Please login first in the terminal using the qadrant CLI: qadrant login <token>',
        },
      ],
      isError: true,
    };
  }

  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'qadrant_start_timer': {
        const { space, specialization = '' } = StartTimerSchema.parse(args);

        // Start new timer
        await apiCall(config.pb_url, config.auth_token, '/api/collections/time_entries/records', {
          method: 'POST',
          body: JSON.stringify({
            start_date: new Date().toISOString(),
            space,
            specialization,
            user: config.user_id
          })
        });

        return {
          content: [
            {
              type: 'text',
              text: `TIMER_STARTED_PROTOCOL: Started tracking Space: ${space}` + (specialization ? ` // Sub: ${specialization}` : ''),
            },
          ],
        };
      }

      case 'qadrant_stop_timer': {
        const filter = `user='${config.user_id}' && completion_time=""`;
        const checkUrl = `/api/collections/time_entries/records?filter=${encodeURIComponent(filter)}`;
        const activeResponse = await apiCall(config.pb_url, config.auth_token, checkUrl) as { items?: TimeEntryRecord[] };
        const activeEntries = activeResponse.items || [];

        if (activeEntries.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'NO_ACTIVE_SESSION: There is no running timer to stop.',
              },
            ],
          };
        }

        for (const entry of activeEntries) {
          await apiCall(config.pb_url, config.auth_token, `/api/collections/time_entries/records/${entry.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              completion_time: new Date().toISOString()
            })
          });
        }

        const stopMsgList = activeEntries.map((e) => {
          const spec = e.specialization ? ` // ${e.specialization}` : '';
          return `"${e.space}${spec}"`;
        }).join(', ');
        return {
          content: [
            {
              type: 'text',
              text: `TIMER_STOPPED_PROTOCOL: Successfully stopped active timer session for ${stopMsgList}.`,
            },
          ],
        };
      }

      case 'qadrant_get_active_timer': {
        const filter = `user='${config.user_id}' && completion_time=""`;
        const checkUrl = `/api/collections/time_entries/records?filter=${encodeURIComponent(filter)}`;
        const activeResponse = await apiCall(config.pb_url, config.auth_token, checkUrl) as { items?: TimeEntryRecord[] };
        const activeEntries = activeResponse.items || [];

        if (activeEntries.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'NO_ACTIVE_SESSION',
              },
            ],
          };
        }

        const lines = activeEntries.map(entry => {
          const elapsedSeconds = Math.floor((Date.now() - new Date(entry.start_date).getTime()) / 1000);
          const specDisplay = entry.specialization ? ` // Sub: ${entry.specialization}` : '';
          return `- Active: Space: ${entry.space}${specDisplay} running for ${elapsedSeconds} seconds.`;
        }).join('\n');

        return {
          content: [
            {
              type: 'text',
              text: `ACTIVE_TIMERS:\n${lines}`,
            },
          ],
        };
      }

      case 'qadrant_list_entries': {
        const parsed = ListEntriesSchema.parse(args || {});
        const limit = parsed.limit || 10;
        const filter = `user='${config.user_id}' && completion_time!=""`;
        const url = `/api/collections/time_entries/records?filter=${encodeURIComponent(filter)}&sort=-start_date&perPage=${limit}`;
        const response = await apiCall(config.pb_url, config.auth_token, url) as { items?: TimeEntryRecord[] };
        const entries = response.items || [];

        if (entries.length === 0) {
          return {
            content: [{ type: 'text', text: 'No tracked time entry records found.' }],
          };
        }

        const formatted = entries.map((e) => {
          const start = new Date(e.start_date).getTime();
          const end = e.completion_time ? new Date(e.completion_time).getTime() : start;
          const hours = (end - start) / (1000 * 60 * 60);
          return `- [${new Date(e.start_date).toLocaleDateString()}] (${hours.toFixed(2)}h) Space: ${e.space} // Sub: ${e.specialization || '-'}`;
        }).join('\n');

        return {
          content: [{ type: 'text', text: `RECENT_COMPLETED_TIME_ENTRIES:\n${formatted}` }],
        };
      }

      case 'qadrant_get_stats': {
        const filter = `user='${config.user_id}' && completion_time!=""`;
        const url = `/api/collections/time_entries/records?filter=${encodeURIComponent(filter)}&perPage=100000`;
        const response = await apiCall(config.pb_url, config.auth_token, url) as { items?: TimeEntryRecord[] };
        const entries = response.items || [];

        let totalMs = 0;
        for (const entry of entries) {
          const start = new Date(entry.start_date).getTime();
          const end = entry.completion_time ? new Date(entry.completion_time).getTime() : start;
          totalMs += Math.max(0, end - start);
        }

        const totalHours = totalMs / (1000 * 60 * 60);
        return {
          content: [
            {
              type: 'text',
              text: `TOTAL_TRACKED_HOURS: ${totalHours.toFixed(2)} hours tracked across ${entries.length} completed sessions.`,
            },
          ],
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      content: [
        {
          type: 'text',
          text: `Error executing tool ${name}: ${errMsg}`,
        },
      ],
      isError: true,
    };
  }
});

// Run server using stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Qadrant MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
