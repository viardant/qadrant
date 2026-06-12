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

const CONFIG_FILE = path.join(os.homedir(), '.apok', 'config.json');

interface Config {
  pb_url: string;
  auth_token: string;
  user_id: string;
}

async function readConfig(): Promise<Config | null> {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return null;
  }
}

async function apiCall(pbUrl: string, token: string, pathStr: string, options: RequestInit = {}): Promise<any> {
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
    name: 'apok-mcp-server',
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
        name: 'apok_start_timer',
        description: 'Starts a new active time tracking timer. If a timer is already running, stops it first.',
        inputSchema: {
          type: 'object',
          properties: {
            task: {
              type: 'string',
              description: 'The description of what activity is being tracked (e.g. "Implementing auth tests")',
            },
            space: {
              type: 'string',
              description: 'Optional top-level project/category space (e.g. "Work", "Piano", "apok")',
            },
            specialization: {
              type: 'string',
              description: 'Optional sub-level specialization within the space (e.g. "Client A", "Chopin")',
            },
          },
          required: ['task'],
        },
      },
      {
        name: 'apok_stop_timer',
        description: 'Stops the currently running active time tracker timer.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'apok_get_active_timer',
        description: 'Retrieves the currently running timer session details or returns null.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'apok_list_entries',
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
        name: 'apok_get_stats',
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
  task: z.string(),
  space: z.string().optional(),
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
          text: 'Error: Not authenticated. Please login first in the terminal using the apok CLI: apok login <token>',
        },
      ],
      isError: true,
    };
  }

  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'apok_start_timer': {
        const { task, space = '', specialization = '' } = StartTimerSchema.parse(args);

        // 1. Check for running timer
        const filter = `user='${config.user_id}' && completed=false`;
        const checkUrl = `/api/collections/time_entries/records?filter=${encodeURIComponent(filter)}`;
        const activeResponse = await apiCall(config.pb_url, config.auth_token, checkUrl);
        const activeEntries = activeResponse.items || [];

        let stoppedTasks: string[] = [];
        if (activeEntries.length > 0) {
          for (const entry of activeEntries) {
            await apiCall(config.pb_url, config.auth_token, `/api/collections/time_entries/records/${entry.id}`, {
              method: 'PATCH',
              body: JSON.stringify({
                completed: true,
                completion_time: new Date().toISOString()
              })
            });
            stoppedTasks.push(entry.task);
          }
        }

        // 2. Start new timer
        const newEntry = await apiCall(config.pb_url, config.auth_token, '/api/collections/time_entries/records', {
          method: 'POST',
          body: JSON.stringify({
            completed: false,
            start_date: new Date().toISOString(),
            task,
            space,
            specialization,
            user: config.user_id
          })
        });

        const stopMsg = stoppedTasks.length > 0 ? `Stopped running session for "${stoppedTasks.join(', ')}". ` : '';
        return {
          content: [
            {
              type: 'text',
              text: `TIMER_STARTED_PROTOCOL: ${stopMsg}Started tracking "${task}"` + (space ? ` in Space: ${space}` : '') + (specialization ? ` // Sub: ${specialization}` : ''),
            },
          ],
        };
      }

      case 'apok_stop_timer': {
        const filter = `user='${config.user_id}' && completed=false`;
        const checkUrl = `/api/collections/time_entries/records?filter=${encodeURIComponent(filter)}`;
        const activeResponse = await apiCall(config.pb_url, config.auth_token, checkUrl);
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
              completed: true,
              completion_time: new Date().toISOString()
            })
          });
        }

        return {
          content: [
            {
              type: 'text',
              text: `TIMER_STOPPED_PROTOCOL: Successfully stopped active timer session for "${activeEntries.map((e: any) => e.task).join(', ')}".`,
            },
          ],
        };
      }

      case 'apok_get_active_timer': {
        const filter = `user='${config.user_id}' && completed=false`;
        const checkUrl = `/api/collections/time_entries/records?filter=${encodeURIComponent(filter)}`;
        const activeResponse = await apiCall(config.pb_url, config.auth_token, checkUrl);
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

        const entry = activeEntries[0];
        const elapsedSeconds = Math.floor((Date.now() - new Date(entry.start_date).getTime()) / 1000);
        return {
          content: [
            {
              type: 'text',
              text: `ACTIVE_TIMER: "${entry.task}" [Space: ${entry.space || 'None'} // Sub: ${entry.specialization || 'None'}] running for ${elapsedSeconds} seconds.`,
            },
          ],
        };
      }

      case 'apok_list_entries': {
        const parsed = ListEntriesSchema.parse(args || {});
        const limit = parsed.limit || 10;
        const filter = `user='${config.user_id}' && completed=true`;
        const url = `/api/collections/time_entries/records?filter=${encodeURIComponent(filter)}&sort=-start_date&perPage=${limit}`;
        const response = await apiCall(config.pb_url, config.auth_token, url);
        const entries = response.items || [];

        if (entries.length === 0) {
          return {
            content: [{ type: 'text', text: 'No tracked time entry records found.' }],
          };
        }

        const formatted = entries.map((e: any) => {
          const start = new Date(e.start_date).getTime();
          const end = e.completion_time ? new Date(e.completion_time).getTime() : start;
          const hours = (end - start) / (1000 * 60 * 60);
          return `- [${new Date(e.start_date).toLocaleDateString()}] (${hours.toFixed(2)}h) Space: ${e.space || '-'} // Sub: ${e.specialization || '-'} // Task: ${e.task}`;
        }).join('\n');

        return {
          content: [{ type: 'text', text: `RECENT_COMPLETED_TIME_ENTRIES:\n${formatted}` }],
        };
      }

      case 'apok_get_stats': {
        const filter = `user='${config.user_id}' && completed=true`;
        const url = `/api/collections/time_entries/records?filter=${encodeURIComponent(filter)}&perPage=100000`;
        const response = await apiCall(config.pb_url, config.auth_token, url);
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
  } catch (err: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Error executing tool ${name}: ${err.message}`,
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
  console.error('Apok MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
