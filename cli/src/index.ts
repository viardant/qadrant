#! /usr/bin/env node

import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { aggregateBy, formatAggregateText, formatAggregateJson, type AggregateOptions, type GroupBy, type Period, type TimeEntry } from '../../shared/src/index.js';

const CONFIG_DIR = path.join(os.homedir(), '.qadrant');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export interface Config {
  pb_url: string;
  auth_token: string;
  user_id: string;
}

export async function readConfig(): Promise<Config | null> {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function writeConfig(config: Config): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

export function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  if (args.length === 0) {
    return { command: null, args: [], options: {} };
  }

  const command = args[0] as 'login' | 'start' | 'stop' | 'status' | 'list' | 'stats' | 'aggregate' | null;
  const remainingArgs: string[] = [];
  const options: {
    url?: string;
    space?: string;
    sub?: string;
    spec?: string;
    limit?: number;
    by?: string;
    period?: string;
    format?: string;
    from?: string;
    to?: string;
    offset?: number;
    includeEntries?: boolean;
  } = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--url' && i + 1 < args.length) {
      options.url = args[++i];
    } else if (arg === '--space' && i + 1 < args.length) {
      options.space = args[++i];
    } else if (arg === '--sub' && i + 1 < args.length) {
      options.sub = args[++i];
    } else if (arg === '--spec' && i + 1 < args.length) {
      options.spec = args[++i];
    } else if (arg === '--limit' && i + 1 < args.length) {
      options.limit = parseInt(args[++i], 10);
    } else if (arg === '--by' && i + 1 < args.length) {
      options.by = args[++i];
    } else if (arg === '--period' && i + 1 < args.length) {
      options.period = args[++i];
    } else if (arg === '--format' && i + 1 < args.length) {
      options.format = args[++i];
    } else if (arg === '--from' && i + 1 < args.length) {
      options.from = args[++i];
    } else if (arg === '--to' && i + 1 < args.length) {
      options.to = args[++i];
    } else if (arg === '--offset' && i + 1 < args.length) {
      options.offset = parseInt(args[++i], 10);
    } else if (arg === '--include-entries') {
      options.includeEntries = true;
    } else {
      remainingArgs.push(arg);
    }
  }

  return {
    command,
    args: remainingArgs,
    options
  };
}

async function apiCall(pbUrl: string, token: string, pathStr: string, options: RequestInit = {}) {
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

function durationStr(startDate: string, completionTime: string | null | undefined): string {
  const start = new Date(startDate).getTime();
  const end = completionTime ? new Date(completionTime).getTime() : start;
  const diffSec = Math.floor(Math.max(0, end - start) / 1000);
  const h = Math.floor(diffSec / 3600);
  const m = Math.floor((diffSec % 3600) / 60);
  const s = diffSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function printHelp() {
  console.log(`
qadrant - Qadrant Time Tracker CLI

Usage:
  qadrant login <token> [--url <pocketbase_url>]
  qadrant start "<space>" [--sub <specialization>]
  qadrant stop
  qadrant status
  qadrant list [--limit <n>] [--space <name>] [--spec <specialization>] [--from <YYYY-MM-DD>] [--to <YYYY-MM-DD>] [--offset <n>] [--format <text|json>]
  qadrant stats [--by <space|combo|day|week|month>] [--period <today|this-week|this-month|all>] [--from <YYYY-MM-DD>] [--to <YYYY-MM-DD>] [--space <name>] [--spec <specialization>] [--include-entries] [--format <text|json>]
  qadrant aggregate --by <space|combo|day|week|month> (deprecated, use "stats --by ...")
`);
}

export async function main() {
  const parsed = parseArgs(process.argv);
  if (!parsed.command) {
    printHelp();
    return;
  }

  if (parsed.command === 'login') {
    const token = parsed.args[0];
    if (!token) {
      console.error('Error: Token is required for login.');
      process.exit(1);
      return;
    }
    const pbUrl = parsed.options.url || process.env.VITE_POCKETBASE_URL || 'http://localhost:8090';
    const normalizedUrl = pbUrl.replace(/\/$/, '');

    try {
      const res = await fetch(`${normalizedUrl}/api/collections/users/auth-refresh`, {
        method: 'POST',
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        throw new Error(`Authentication failed with status ${res.status}`);
      }

      const data = await res.json() as { token?: string; record?: { id: string } };
      await writeConfig({
        pb_url: normalizedUrl,
        auth_token: data.token || token,
        user_id: data.record?.id || ''
      });

      console.log('LOGIN_SUCCESSFUL_AUTHENTICATED');
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`Authentication error: ${errMsg}`);
      process.exit(1);
      return;
    }
    return;
  }

  // All other commands require config
  const config = await readConfig();
  if (!config || !config.auth_token || !config.pb_url || !config.user_id) {
    console.error('Error: Not authenticated. Please login first: qadrant login <token>');
    process.exit(1);
    return;
  }

  if (parsed.command === 'start') {
    const space = parsed.args[0];
    if (!space) {
      console.error('Error: Space name is required.');
      process.exit(1);
      return;
    }
    const specialization = parsed.options.sub || '';

    try {
      await apiCall(config.pb_url, config.auth_token, '/api/collections/time_entries/records', {
        method: 'POST',
        body: JSON.stringify({
          start_date: new Date().toISOString(),
          space,
          specialization,
          user: config.user_id
        })
      });

      console.log('TIMER_STARTED_PROTOCOL');
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${errMsg}`);
      process.exit(1);
      return;
    }
    return;
  }

  if (parsed.command === 'stop') {
    try {
      const filter = `user='${config.user_id}' && completion_time=""`;
      const url = `/api/collections/time_entries/records?filter=${encodeURIComponent(filter)}`;
      const activeResponse = await apiCall(config.pb_url, config.auth_token, url);
      const activeEntries = activeResponse.items || [];

      if (activeEntries.length > 0) {
        for (const entry of activeEntries) {
          await apiCall(config.pb_url, config.auth_token, `/api/collections/time_entries/records/${entry.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              completion_time: new Date().toISOString()
            })
          });
        }
      }
      console.log('TIMER_STOPPED_PROTOCOL');
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${errMsg}`);
      process.exit(1);
      return;
    }
    return;
  }

  if (parsed.command === 'status') {
    try {
      const filter = `user='${config.user_id}' && completion_time=""`;
      const url = `/api/collections/time_entries/records?filter=${encodeURIComponent(filter)}`;
      const activeResponse = await apiCall(config.pb_url, config.auth_token, url);
      const activeEntries = activeResponse.items || [];

      if (activeEntries.length === 0) {
        console.log('NO_ACTIVE_SESSION');
        return;
      }

      for (const entry of activeEntries) {
        const elapsedSeconds = Math.floor((Date.now() - new Date(entry.start_date).getTime()) / 1000);
        const safeSec = Math.max(0, elapsedSeconds);
        const hours = Math.floor(safeSec / 3600);
        const minutes = Math.floor((safeSec % 3600) / 60);
        const seconds = safeSec % 60;
        const formattedTime = [hours, minutes, seconds]
          .map(v => String(v).padStart(2, '0'))
          .join(':');

        const specializationStr = entry.specialization ? ` // ${entry.specialization}` : '';
        console.log(`${formattedTime} - ${entry.space}${specializationStr}`);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${errMsg}`);
      process.exit(1);
      return;
    }
    return;
  }

  if (parsed.command === 'list') {
    try {
      const limit = parsed.options.limit || 10;
      const offset = parsed.options.offset || 0;
      const format = parsed.options.format ?? 'text';

      let filter = `user='${config.user_id}' && completion_time!=""`;
      if (parsed.options.space) {
        filter += ` && space='${parsed.options.space}'`;
      }
      if (parsed.options.spec) {
        filter += ` && specialization='${parsed.options.spec}'`;
      }
      if (parsed.options.from) {
        filter += ` && start_date>='${parsed.options.from} 00:00:00'`;
      }
      if (parsed.options.to) {
        filter += ` && start_date<='${parsed.options.to} 23:59:59'`;
      }

      const url = `/api/collections/time_entries/records?filter=${encodeURIComponent(filter)}&sort=-start_date&perPage=${limit}&skipTotal=false${offset > 0 ? `&offset=${offset}` : ''}`;
      const response = await apiCall(config.pb_url, config.auth_token, url) as { items?: Array<{ id: string; space: string; specialization?: string; start_date: string; completion_time?: string }>; totalItems?: number };
      const entries = response.items || [];
      const total = response.totalItems ?? 0;

      if (entries.length === 0) {
        console.log('No tracked sessions found.');
        return;
      }

      if (format === 'json') {
        console.log(JSON.stringify({
          entries: entries.map(e => ({
            id: e.id,
            space: e.space,
            specialization: e.specialization || '',
            start_date: e.start_date,
            completion_time: e.completion_time || null,
          })),
          total,
          limit,
          offset,
        }, null, 2));
        return;
      }

      console.log('DATE       | DURATION | SPACE      | SUB');
      console.log('-----------+----------+------------+------------');

      for (const entry of entries) {
        const dateStr = new Date(entry.start_date).toLocaleDateString();
        const diffSec = Math.floor(Math.max(0, (entry.completion_time ? new Date(entry.completion_time).getTime() : new Date(entry.start_date).getTime()) - new Date(entry.start_date).getTime()) / 1000);
        const h = Math.floor(diffSec / 3600);
        const m = Math.floor((diffSec % 3600) / 60);
        const s = diffSec % 60;
        const durationStrVal = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        const spaceStr = (entry.space || '').slice(0, 10).padEnd(10);
        const subStr = (entry.specialization || '').slice(0, 10).padEnd(10);
        console.log(`${dateStr.padEnd(10)} | ${durationStrVal} | ${spaceStr} | ${subStr}`);
      }

      const shown = offset + entries.length;
      if (shown < total) {
        console.log(`\nShowing ${offset + 1}-${shown} of ${total} entries. Use --offset ${shown} to see more.`);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${errMsg}`);
      process.exit(1);
      return;
    }
    return;
  }

  // aggregate is deprecated — print warning then fall through to stats
  if (parsed.command === 'aggregate') {
    console.error('qadrant: "aggregate" is deprecated. Use "stats --by ..." instead.');
  }

  if (parsed.command === 'aggregate' || parsed.command === 'stats') {
    const by = parsed.options.by;
    const period = parsed.options.period;
    const format = parsed.options.format ?? 'text';

    if (by !== undefined && !['space', 'combo', 'day', 'week', 'month'].includes(by)) {
      console.error('ERROR: --by must be one of space|combo|day|week|month');
      process.exit(1);
      return;
    }
    if (period !== undefined && !['today', 'this-week', 'this-month', 'all'].includes(period)) {
      console.error('ERROR: --period must be one of today|this-week|this-month|all');
      process.exit(1);
      return;
    }
    if (!['text', 'json'].includes(format)) {
      console.error('ERROR: --format must be text|json');
      process.exit(1);
      return;
    }

    const hasFrom = parsed.options.from !== undefined;
    const hasTo = parsed.options.to !== undefined;
    if (hasFrom !== hasTo) {
      console.error('ERROR: --from and --to must be used together');
      process.exit(1);
      return;
    }
    if (hasFrom && hasTo) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(parsed.options.from!) || !dateRegex.test(parsed.options.to!)) {
        console.error('ERROR: --from and --to must be in YYYY-MM-DD format');
        process.exit(1);
        return;
      }
      if (parsed.options.from! > parsed.options.to!) {
        console.error('ERROR: --from date must be before or equal to --to date');
        process.exit(1);
        return;
      }
    }

    try {
      let filter = `user='${config.user_id}' && completion_time!=""`;
      if (parsed.options.space) {
        filter += ` && space='${parsed.options.space}'`;
      }
      if (parsed.options.spec) {
        filter += ` && specialization='${parsed.options.spec}'`;
      }
      if (hasFrom) {
        filter += ` && start_date>='${parsed.options.from} 00:00:00'`;
      }
      if (hasTo) {
        filter += ` && start_date<='${parsed.options.to} 23:59:59'`;
      }

      const url = `/api/collections/time_entries/records?filter=${encodeURIComponent(filter)}&perPage=100000&sort=-start_date`;
      const response = await apiCall(config.pb_url, config.auth_token, url) as { items?: Array<{ id: string; space: string; specialization?: string; start_date: string; completion_time?: string }> };
      const rawEntries = response.items || [];
      const entries: TimeEntry[] = rawEntries
        .filter((e) => e.completion_time)
        .map((e) => ({
          id: e.id,
          space: e.space || '',
          specialization: e.specialization || '',
          start_date: e.start_date,
          completion_time: e.completion_time || null,
          user: config.user_id,
        }));

      if (by) {
        const aggOptions: AggregateOptions = {
          by: by as GroupBy,
          period: (period as Period) || 'all',
          ...(parsed.options.includeEntries ? { includeEntries: true } : {}),
        };
        const result = aggregateBy(entries, aggOptions);
        if (format === 'json') {
          console.log(formatAggregateJson(result));
        } else {
          console.log(formatAggregateText(result));
          if (parsed.options.includeEntries) {
            for (const row of result.rows) {
              if (row.entries && row.entries.length > 0) {
                console.log(`\n  ${row.key}:`);
                for (const entry of row.entries) {
                  const spec = entry.specialization ? ` / ${entry.specialization}` : '';
                  console.log(`    ${durationStr(entry.start_date, entry.completion_time)}  ${entry.space}${spec}`);
                }
              }
            }
          }
        }
        return;
      }

      // Legacy no-by path: single total number
      let totalMs = 0;
      for (const entry of entries) {
        const start = new Date(entry.start_date).getTime();
        const end = entry.completion_time ? new Date(entry.completion_time).getTime() : start;
        totalMs += Math.max(0, end - start);
      }
      const totalHours = totalMs / (1000 * 60 * 60);
      console.log(`TOTAL_TRACKED_HOURS: ${totalHours.toFixed(2)}`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${errMsg}`);
      process.exit(1);
      return;
    }
    return;
  }

  printHelp();
}

if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
