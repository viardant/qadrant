#! /usr/bin/env node

import os from 'os';
import path from 'path';
import fs from 'fs/promises';

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
    limit?: number;
    by?: string;
    period?: string;
    format?: string;
  } = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--url' && i + 1 < args.length) {
      options.url = args[++i];
    } else if (arg === '--space' && i + 1 < args.length) {
      options.space = args[++i];
    } else if (arg === '--sub' && i + 1 < args.length) {
      options.sub = args[++i];
    } else if (arg === '--limit' && i + 1 < args.length) {
      options.limit = parseInt(args[++i], 10);
    } else if (arg === '--by' && i + 1 < args.length) {
      options.by = args[++i];
    } else if (arg === '--period' && i + 1 < args.length) {
      options.period = args[++i];
    } else if (arg === '--format' && i + 1 < args.length) {
      options.format = args[++i];
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

function printHelp() {
  console.log(`
qadrant - Qadrant Time Tracker CLI

Usage:
  qadrant login <token> [--url <pocketbase_url>]
  qadrant start "<space>" [--sub <specialization>]
  qadrant stop
  qadrant status
  qadrant list [--limit <n>]
  qadrant stats
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
      const filter = `user='${config.user_id}' && completion_time!=""`;
      const url = `/api/collections/time_entries/records?filter=${encodeURIComponent(filter)}&sort=-start_date&perPage=${limit}`;
      const response = await apiCall(config.pb_url, config.auth_token, url);
      const entries = response.items || [];

      if (entries.length === 0) {
        console.log('No tracked sessions found.');
        return;
      }

      console.log('DATE       | DURATION | SPACE      | SUB');
      console.log('-----------+----------+------------+------------');

      for (const entry of entries) {
        const dateStr = new Date(entry.start_date).toLocaleDateString();
        const start = new Date(entry.start_date).getTime();
        const end = entry.completion_time ? new Date(entry.completion_time).getTime() : start;
        const diffSec = Math.floor(Math.max(0, end - start) / 1000);
        const h = Math.floor(diffSec / 3600);
        const m = Math.floor((diffSec % 3600) / 60);
        const s = diffSec % 60;
        const durationStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

        const spaceStr = (entry.space || '').slice(0, 10).padEnd(10);
        const subStr = (entry.specialization || '').slice(0, 10).padEnd(10);

        console.log(`${dateStr.padEnd(10)} | ${durationStr} | ${spaceStr} | ${subStr}`);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${errMsg}`);
      process.exit(1);
      return;
    }
    return;
  }

  if (parsed.command === 'stats') {
    try {
      const filter = `user='${config.user_id}' && completion_time!=""`;
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
