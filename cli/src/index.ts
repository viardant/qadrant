#! /usr/bin/env node

import os from 'os';
import path from 'path';
import fs from 'fs/promises';

const CONFIG_DIR = path.join(os.homedir(), '.apok');
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
  } catch (err) {
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

  const command = args[0] as 'login' | 'start' | 'stop' | 'status' | 'list' | 'stats' | null;
  const remainingArgs: string[] = [];
  const options: Record<string, any> = {};

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
apok - Apok Time Tracker CLI

Usage:
  apok login <token> [--url <pocketbase_url>]
  apok start "<task>" [--space <space>] [--sub <specialization>]
  apok stop
  apok status
  apok list [--limit <n>]
  apok stats
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

      const data = await res.json() as any;
      await writeConfig({
        pb_url: normalizedUrl,
        auth_token: data.token || token,
        user_id: data.record?.id
      });

      console.log('LOGIN_SUCCESSFUL_AUTHENTICATED');
    } catch (err: any) {
      console.error(`Authentication error: ${err.message}`);
      process.exit(1);
      return;
    }
    return;
  }

  // All other commands require config
  const config = await readConfig();
  if (!config || !config.auth_token || !config.pb_url || !config.user_id) {
    console.error('Error: Not authenticated. Please login first: apok login <token>');
    process.exit(1);
    return;
  }

  if (parsed.command === 'start') {
    const task = parsed.args[0];
    if (!task) {
      console.error('Error: Task description is required.');
      process.exit(1);
      return;
    }
    const space = parsed.options.space || '';
    const specialization = parsed.options.sub || '';

    try {
      // Check if an active timer is running
      const filter = `user='${config.user_id}' && completed=false`;
      const url = `/api/collections/time_entries/records?filter=${encodeURIComponent(filter)}`;
      const activeResponse = await apiCall(config.pb_url, config.auth_token, url);
      const activeEntries = activeResponse.items || [];

      if (activeEntries.length > 0) {
        for (const entry of activeEntries) {
          await apiCall(config.pb_url, config.auth_token, `/api/collections/time_entries/records/${entry.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              completed: true,
              completion_time: new Date().toISOString()
            })
          });
        }
      }

      // Start new timer
      await apiCall(config.pb_url, config.auth_token, '/api/collections/time_entries/records', {
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

      console.log('TIMER_STARTED_PROTOCOL');
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
      return;
    }
    return;
  }

  if (parsed.command === 'stop') {
    try {
      const filter = `user='${config.user_id}' && completed=false`;
      const url = `/api/collections/time_entries/records?filter=${encodeURIComponent(filter)}`;
      const activeResponse = await apiCall(config.pb_url, config.auth_token, url);
      const activeEntries = activeResponse.items || [];

      if (activeEntries.length > 0) {
        for (const entry of activeEntries) {
          await apiCall(config.pb_url, config.auth_token, `/api/collections/time_entries/records/${entry.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              completed: true,
              completion_time: new Date().toISOString()
            })
          });
        }
      }
      console.log('TIMER_STOPPED_PROTOCOL');
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
      return;
    }
    return;
  }

  if (parsed.command === 'status') {
    try {
      const filter = `user='${config.user_id}' && completed=false`;
      const url = `/api/collections/time_entries/records?filter=${encodeURIComponent(filter)}`;
      const activeResponse = await apiCall(config.pb_url, config.auth_token, url);
      const activeEntries = activeResponse.items || [];

      if (activeEntries.length === 0) {
        console.log('NO_ACTIVE_SESSION');
        return;
      }

      const entry = activeEntries[0];
      const elapsedSeconds = Math.floor((Date.now() - new Date(entry.start_date).getTime()) / 1000);
      const safeSec = Math.max(0, elapsedSeconds);
      const hours = Math.floor(safeSec / 3600);
      const minutes = Math.floor((safeSec % 3600) / 60);
      const seconds = safeSec % 60;
      const formattedTime = [hours, minutes, seconds]
        .map(v => String(v).padStart(2, '0'))
        .join(':');

      console.log(`${formattedTime} - ${entry.task}`);
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
      return;
    }
    return;
  }

  if (parsed.command === 'list') {
    try {
      const limit = parsed.options.limit || 10;
      const filter = `user='${config.user_id}' && completed=true`;
      const url = `/api/collections/time_entries/records?filter=${encodeURIComponent(filter)}&sort=-start_date&perPage=${limit}`;
      const response = await apiCall(config.pb_url, config.auth_token, url);
      const entries = response.items || [];

      if (entries.length === 0) {
        console.log('No tracked sessions found.');
        return;
      }

      console.log('DATE       | DURATION | SPACE      | SUB        | TASK');
      console.log('-----------+----------+------------+------------+---------------------------');

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
        const taskStr = entry.task || '';

        console.log(`${dateStr.padEnd(10)} | ${durationStr} | ${spaceStr} | ${subStr} | ${taskStr}`);
      }
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
      return;
    }
    return;
  }

  if (parsed.command === 'stats') {
    try {
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
      console.log(`TOTAL_TRACKED_HOURS: ${totalHours.toFixed(2)}`);
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
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
