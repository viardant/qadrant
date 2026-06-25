#! /usr/bin/env node

import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import {
  aggregateBy,
  windowForPeriod,
  formatAggregateText,
  formatAggregateJson,
  type AggregateOptions,
  type GroupBy,
  type Period,
  type TimeEntry,
} from '../../shared/src/index.js';

const CONFIG_DIR = path.join(os.homedir(), '.qadrant');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const CONFIG_FILE_MODE = 0o600;

export interface Config {
  pb_url: string;
  auth_token: string;
  user_id: string;
}

export interface ParsedArgs {
  global: { noRefresh: boolean };
  command: string | null;
  args: string[];
  options: {
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
    minDuration?: string;
    dedup?: boolean;
    ignoreSpec?: boolean;
  };
}

export class ApiError extends Error {
  constructor(
    public path: string,
    public status: number,
    public body: string,
  ) {
    super(`API error ${path} (${status}): ${body}`);
    this.name = 'ApiError';
  }
}

export class SessionExpiredError extends Error {
  constructor(message = 'Session expired. Please log in again: qadrant login <token>') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

export class CliError extends Error {
  constructor(message: string, public exitCode: number = 1) {
    super(message);
    this.name = 'CliError';
  }
}

export async function readConfig(): Promise<Config | null> {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(data) as Config;
    if (!parsed.pb_url || !parsed.auth_token || !parsed.user_id) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function writeConfig(config: Config): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
  await fs.chmod(CONFIG_FILE, CONFIG_FILE_MODE);
}

export async function deleteConfig(): Promise<void> {
  try {
    await fs.unlink(CONFIG_FILE);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err;
    }
  }
}

const PER_COMMAND_FLAGS = new Set([
  '--url', '--space', '--sub', '--spec',
  '--limit', '--by', '--period', '--format',
  '--from', '--to', '--offset', '--min-duration',
]);

function readFlagValue(args: string[], i: number, flag: string): { value: string; next: number } {
  if (i + 1 >= args.length) {
    throw new CliError(`Flag ${flag} requires a value.`);
  }
  return { value: args[i + 1], next: i + 2 };
}

function applyOption(opts: ParsedArgs['options'], flag: string, value: string): void {
  switch (flag) {
    case '--url': opts.url = value; break;
    case '--space': opts.space = value; break;
    case '--sub': opts.sub = value; break;
    case '--spec': opts.spec = value; break;
    case '--limit': {
      const parsed = parseInt(value, 10);
      if (isNaN(parsed)) {
        throw new CliError('Value for flag --limit must be an integer.');
      }
      opts.limit = parsed;
      break;
    }
    case '--by': opts.by = value; break;
    case '--period': opts.period = value; break;
    case '--format': opts.format = value; break;
    case '--min-duration': opts.minDuration = value; break;
    case '--from': opts.from = parseRelativeDateOrPreset(value); break;
    case '--to': opts.to = parseRelativeDateOrPreset(value); break;
    case '--offset': {
      const parsed = parseInt(value, 10);
      if (isNaN(parsed)) {
        throw new CliError('Value for flag --offset must be an integer.');
      }
      opts.offset = parsed;
      break;
    }
  }
}

function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseRelativeDateOrPreset(input: string): string {
  const normalized = input.trim().toLowerCase();
  if (normalized === 'today') {
    return formatLocalDate(new Date());
  }
  if (normalized === 'yesterday') {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return formatLocalDate(d);
  }
  const relativeMatch = normalized.match(/^(\d+)\s+(day|week|month)s?\s+ago$/);
  if (relativeMatch) {
    const count = parseInt(relativeMatch[1], 10);
    const unit = relativeMatch[2];
    const d = new Date();
    if (unit === 'day') d.setDate(d.getDate() - count);
    if (unit === 'week') d.setDate(d.getDate() - count * 7);
    if (unit === 'month') d.setMonth(d.getMonth() - count);
    return formatLocalDate(d);
  }
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(normalized)) {
    throw new CliError(`Invalid date format "${input}". Use YYYY-MM-DD, "today", "yesterday", or "N days/weeks/months ago".`);
  }
  return normalized;
}

export function parseDurationToMs(input: string): number {
  const match = input.trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(s|m|h)$/);
  if (!match) {
    throw new CliError(`Invalid duration "${input}". Use shorthand formats like "30s", "5m", or "1.5h".`);
  }
  const value = parseFloat(match[1]);
  const unit = match[2];
  if (unit === 's') return value * 1000;
  if (unit === 'm') return value * 60 * 1000;
  if (unit === 'h') return value * 60 * 60 * 1000;
  return 0;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const result: ParsedArgs = {
    global: { noRefresh: false },
    command: null,
    args: [],
    options: {},
  };
  if (args.length === 0) return result;

  if (args.includes('--help') || args.includes('-h') || args[0] === 'help') {
    result.command = 'help';
    return result;
  }

  let i = 0;

  // First pass: global flags (must come before the subcommand).
  while (i < args.length && args[i].startsWith('--')) {
    const flag = args[i];
    if (flag === '--no-refresh') {
      result.global.noRefresh = true;
      i++;
      continue;
    }
    if (flag === '--url') {
      const { value, next } = readFlagValue(args, i, flag);
      result.options.url = value;
      i = next;
      continue;
    }
    throw new CliError(`Unknown flag: ${flag}`);
  }

  // Subcommand.
  if (i < args.length && !args[i].startsWith('--')) {
    result.command = args[i];
    i++;
  } else if (i > 0) {
    throw new CliError('A subcommand is required when using global flags.');
  }

  if (result.command === null) {
    return result;
  }

  // Second pass: per-command flags.
  while (i < args.length) {
    const arg = args[i];
    if (arg === '--no-refresh') {
      throw new CliError('--no-refresh must be placed before the subcommand (e.g. `qadrant --no-refresh start work`).');
    }
    if (arg === '--include-entries') {
      result.options.includeEntries = true;
      i++;
      continue;
    }
    if (arg === '--dedup') {
      result.options.dedup = true;
      i++;
      continue;
    }
    if (arg === '--ignore-spec') {
      result.options.ignoreSpec = true;
      i++;
      continue;
    }
    if (PER_COMMAND_FLAGS.has(arg)) {
      const { value, next } = readFlagValue(args, i, arg);
      applyOption(result.options, arg, value);
      i = next;
      continue;
    }
    if (arg.startsWith('--')) {
      throw new CliError(`Unknown flag: ${arg}`);
    }
    result.args.push(arg);
    i++;
  }

  return result;
}

interface RefreshResult {
  token: string;
  userId: string;
}

export async function refreshToken(pbUrl: string, currentToken: string): Promise<RefreshResult | null> {
  const res = await fetch(`${pbUrl}/api/collections/users/auth-refresh`, {
    method: 'POST',
    headers: {
      'Authorization': currentToken,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { token?: string; record?: { id?: string } };
  if (!data.token) return null;
  return { token: data.token, userId: data.record?.id ?? '' };
}

export interface ApiCallOptions {
  noRefresh?: boolean;
  onTokenRotated?: (newConfig: Config) => Promise<void>;
}

export async function apiCall(
  state: Config,
  pathStr: string,
  options: RequestInit = {},
  callOpts: ApiCallOptions = {},
): Promise<unknown> {
  const doFetch = (token: string) =>
    fetch(`${state.pb_url}${pathStr}`, {
      ...options,
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
        ...((options.headers as Record<string, string>) || {}),
      },
    });

  let res = await doFetch(state.auth_token);

  if (res.status === 401 && !callOpts.noRefresh) {
    const rotated = await refreshToken(state.pb_url, state.auth_token);
    if (rotated) {
      state.auth_token = rotated.token;
      if (rotated.userId) state.user_id = rotated.userId;
      await writeConfig(state);
      if (callOpts.onTokenRotated) {
        await callOpts.onTokenRotated({ ...state });
      }
      res = await doFetch(state.auth_token);
    }
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 401) {
      throw new SessionExpiredError();
    }
    throw new ApiError(pathStr, res.status, body);
  }
  return res.json();
}

function decodeJwtExp(token: string): number | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload + '==='.slice((payload.length + 3) % 4);
    const json = Buffer.from(padded, 'base64').toString('utf-8');
    const data = JSON.parse(json) as { exp?: number };
    return typeof data.exp === 'number' ? data.exp : null;
  } catch {
    return null;
  }
}

function maskToken(token: string): string {
  if (token.length <= 12) return '***';
  return `${token.slice(0, 6)}…${token.slice(-4)}`;
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
  qadrant [--no-refresh] <command> [args] [options]

Commands:
  qadrant login <token> [--url <pocketbase_url>]
  qadrant logout
  qadrant whoami [--format text|json]
  qadrant start "<space>" [--sub <specialization>]
  qadrant stop
  qadrant status
  qadrant list [--limit <n>] [--space <name>] [--spec <specialization>] [--from <YYYY-MM-DD>] [--to <YYYY-MM-DD>] [--offset <n>] [--format <text|json>]
  qadrant stats [--by <space|combo|day|week|month>] [--period <today|this-week|this-month|all>] [--from <YYYY-MM-DD>] [--to <YYYY-MM-DD>] [--space <name>] [--spec <specialization>] [--include-entries] [--format <text|json>]
  qadrant aggregate --by <space|combo|day|week|month> (deprecated, use "stats --by ...")
  qadrant insights [--period <today|this-week|this-month|all|yesterday|last-week|last-month|last-30-days>] [--from <YYYY-MM-DD>] [--to <YYYY-MM-DD>] [--format <text|json>]

Global Flags:
  --no-refresh      Disable transparent token refresh on 401/403.
  --url <url>       Override the configured PocketBase URL for a single call.

Get a token: open the web app, go to Settings → CLI_AND_AI_AGENT_ACCESS, copy the token.
`);
}

async function requireConfig(urlOverride?: string): Promise<Config> {
  const config = await readConfig();
  if (!config || !config.auth_token || !config.pb_url || !config.user_id) {
    throw new CliError('Not authenticated. Please login first: qadrant login <token>');
  }
  if (urlOverride) {
    config.pb_url = urlOverride;
  }
  return config;
}

export async function handleLogin(parsed: ParsedArgs): Promise<void> {
  const token = parsed.args[0];
  if (!token) {
    throw new CliError('Token is required for login.');
  }
  const pbUrl = parsed.options.url || process.env.VITE_POCKETBASE_URL || 'http://localhost:8090';
  const normalizedUrl = pbUrl.replace(/\/$/, '');

  const rotated = await refreshToken(normalizedUrl, token);
  if (!rotated) {
    throw new CliError('Authentication failed: token was rejected by the server.');
  }

  await writeConfig({
    pb_url: normalizedUrl,
    auth_token: rotated.token,
    user_id: rotated.userId,
  });

  console.log('LOGIN_SUCCESSFUL_AUTHENTICATED');
}

export async function handleLogout(): Promise<void> {
  await deleteConfig();
  console.log('LOGOUT_PROTOCOL');
}

export async function handleWhoami(parsed: ParsedArgs): Promise<void> {
  const config = await requireConfig(parsed.options.url);
  const format = parsed.options.format ?? 'text';
  const exp = decodeJwtExp(config.auth_token);
  const payload = {
    pb_url: config.pb_url,
    user_id: config.user_id,
    auth_token: maskToken(config.auth_token),
    ...(exp ? { expires_at: new Date(exp * 1000).toISOString() } : {}),
  };
  if (format === 'json') {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(`pb_url:     ${payload.pb_url}`);
  console.log(`user_id:    ${payload.user_id}`);
  console.log(`auth_token: ${payload.auth_token}`);
  if (payload.expires_at) {
    console.log(`expires_at: ${payload.expires_at}`);
  }
}

export async function handleStart(state: Config, parsed: ParsedArgs, callOpts: ApiCallOptions): Promise<void> {
  const space = parsed.args[0];
  if (!space) {
    throw new CliError('Space name is required.');
  }
  const specialization = parsed.options.sub || '';

  await apiCall(state, '/api/collections/time_entries/records', {
    method: 'POST',
    body: JSON.stringify({
      start_date: new Date().toISOString(),
      space,
      specialization,
      user: state.user_id,
    }),
  }, callOpts);

  console.log('TIMER_STARTED_PROTOCOL');
}

export async function handleStop(state: Config, callOpts: ApiCallOptions): Promise<void> {
  const filter = `user='${state.user_id}' && completion_time=""`;
  const url = `/api/collections/time_entries/records?filter=${encodeURIComponent(filter)}`;
  const activeResponse = (await apiCall(state, url, undefined, callOpts)) as { items?: Array<{ id: string }> };
  const activeEntries = activeResponse.items || [];

  if (activeEntries.length > 0) {
    for (const entry of activeEntries) {
      await apiCall(state, `/api/collections/time_entries/records/${entry.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ completion_time: new Date().toISOString() }),
      }, callOpts);
    }
  }
  console.log('TIMER_STOPPED_PROTOCOL');
}

export async function handleStatus(state: Config, callOpts: ApiCallOptions): Promise<void> {
  const filter = `user='${state.user_id}' && completion_time=""`;
  const url = `/api/collections/time_entries/records?filter=${encodeURIComponent(filter)}`;
  const activeResponse = (await apiCall(state, url, undefined, callOpts)) as { items?: Array<{ start_date: string; space: string; specialization?: string }> };
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
}

export async function handleList(state: Config, parsed: ParsedArgs, callOpts: ApiCallOptions): Promise<void> {
  const limit = parsed.options.limit || 10;
  const offset = parsed.options.offset || 0;
  const format = parsed.options.format ?? 'text';

  let filter = `user='${state.user_id}' && completion_time!=""`;
  if (parsed.options.space) filter += ` && space='${parsed.options.space}'`;
  if (parsed.options.spec) filter += ` && specialization='${parsed.options.spec}'`;
  if (parsed.options.from) filter += ` && start_date>='${parsed.options.from} 00:00:00'`;
  if (parsed.options.to) filter += ` && start_date<='${parsed.options.to} 23:59:59'`;

  const url = `/api/collections/time_entries/records?filter=${encodeURIComponent(filter)}&sort=-start_date&perPage=${limit}&skipTotal=false${offset > 0 ? `&offset=${offset}` : ''}`;
  const response = (await apiCall(state, url, undefined, callOpts)) as {
    items?: Array<{ id: string; space: string; specialization?: string; start_date: string; completion_time?: string }>;
    totalItems?: number;
  };

  let entries = response.items || [];
  const total = response.totalItems ?? 0;

  if (entries.length === 0) {
    console.log('No tracked sessions found.');
    return;
  }

  if (parsed.options.minDuration) {
    const minMs = parseDurationToMs(parsed.options.minDuration);
    entries = entries.filter(e => {
      const endMs = e.completion_time ? new Date(e.completion_time).getTime() : new Date(e.start_date).getTime();
      const durationMs = endMs - new Date(e.start_date).getTime();
      return durationMs >= minMs;
    });
  }

  if (parsed.options.ignoreSpec) {
    entries = entries.map(e => ({ ...e, specialization: '' }));
  }

  if (parsed.options.dedup) {
    const squashedMap = new Map<string, { date: string; space: string; specialization: string; durationMs: number }>();
    for (const entry of entries) {
      const localDate = new Date(entry.start_date).toLocaleDateString();
      const endMs = entry.completion_time ? new Date(entry.completion_time).getTime() : new Date(entry.start_date).getTime();
      const durationMs = Math.max(0, endMs - new Date(entry.start_date).getTime());
      
      const key = `${localDate}|${entry.space}|${entry.specialization || ''}`;
      const existing = squashedMap.get(key);
      if (existing) {
        existing.durationMs += durationMs;
      } else {
        squashedMap.set(key, {
          date: localDate,
          space: entry.space,
          specialization: entry.specialization || '',
          durationMs,
        });
      }
    }
    
    const squashedEntries = Array.from(squashedMap.values());
    if (format === 'json') {
      console.log(JSON.stringify({
        entries: squashedEntries.map(e => ({
          date: e.date,
          space: e.space,
          specialization: e.specialization,
          duration_ms: e.durationMs,
        })),
        total: squashedEntries.length,
        limit,
        offset,
      }, null, 2));
      return;
    }
    
    console.log('DATE       | DURATION | SPACE      | SUB');
    console.log('-----------+----------+------------+------------');
    for (const entry of squashedEntries) {
      const diffSec = Math.floor(entry.durationMs / 1000);
      const h = Math.floor(diffSec / 3600);
      const m = Math.floor((diffSec % 3600) / 60);
      const s = diffSec % 60;
      const durationStrVal = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      const spaceStr = entry.space.slice(0, 10).padEnd(10);
      const subStr = entry.specialization.slice(0, 10).padEnd(10);
      console.log(`${entry.date.padEnd(10)} | ${durationStrVal} | ${spaceStr} | ${subStr}`);
    }
    
    const shown = offset + entries.length;
    if (shown < total) {
      console.log(`\nShowing raw entries ${offset + 1}-${shown} of ${total}. Use --offset ${shown} to see more.`);
    }
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
    const endMs = entry.completion_time ? new Date(entry.completion_time).getTime() : new Date(entry.start_date).getTime();
    const diffSec = Math.floor(Math.max(0, endMs - new Date(entry.start_date).getTime()) / 1000);
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
}

export async function handleStats(state: Config, parsed: ParsedArgs, callOpts: ApiCallOptions): Promise<void> {
  const by = parsed.options.by;
  const period = parsed.options.period;
  const format = parsed.options.format ?? 'text';

  if (by !== undefined && !['space', 'combo', 'day', 'week', 'month', 'hour-of-day', 'day-of-week'].includes(by)) {
    throw new CliError('--by must be one of space|combo|day|week|month|hour-of-day|day-of-week');
  }
  if (period !== undefined && !['today', 'this-week', 'this-month', 'all', 'yesterday', 'last-week', 'last-month', 'last-30-days'].includes(period)) {
    throw new CliError('--period must be one of today|this-week|this-month|all|yesterday|last-week|last-month|last-30-days');
  }
  if (!['text', 'json'].includes(format)) {
    throw new CliError('--format must be text|json');
  }

  const hasFrom = parsed.options.from !== undefined;
  const hasTo = parsed.options.to !== undefined;
  if (hasFrom !== hasTo) {
    throw new CliError('--from and --to must be used together');
  }
  if (hasFrom && hasTo) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(parsed.options.from!) || !dateRegex.test(parsed.options.to!)) {
      throw new CliError('--from and --to must be in YYYY-MM-DD format');
    }
    if (parsed.options.from! > parsed.options.to!) {
      throw new CliError('--from date must be before or equal to --to date');
    }
  }

  let periodFrom = parsed.options.from;
  let periodTo = parsed.options.to;
  if (period && period !== 'all' && !periodFrom && !periodTo) {
    const window = windowForPeriod(period as Period);
    if (window) {
      periodFrom = window.start;
      periodTo = window.end;
    }
  }

  let filter = `user='${state.user_id}' && completion_time!=""`;
  if (parsed.options.space) filter += ` && space='${parsed.options.space}'`;
  if (parsed.options.spec) filter += ` && specialization='${parsed.options.spec}'`;
  if (periodFrom) filter += ` && start_date>='${periodFrom} 00:00:00'`;
  if (periodTo) filter += ` && start_date<='${periodTo} 23:59:59'`;

  const url = `/api/collections/time_entries/records?filter=${encodeURIComponent(filter)}&perPage=100000&sort=-start_date`;
  const response = (await apiCall(state, url, undefined, callOpts)) as {
    items?: Array<{ id: string; space: string; specialization?: string; start_date: string; completion_time?: string }>;
  };
  const rawEntries = response.items || [];
  const entries: TimeEntry[] = rawEntries
    .filter((e) => e.completion_time)
    .map((e) => ({
      id: e.id,
      space: e.space || '',
      specialization: e.specialization || '',
      start_date: e.start_date,
      completion_time: e.completion_time || null,
      user: state.user_id,
    }));

  if (by) {
    const aggOptions: AggregateOptions = {
      by: by as GroupBy,
      period: (period as Period) || 'all',
      from: periodFrom,
      to: periodTo,
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

  let totalMs = 0;
  for (const entry of entries) {
    const start = new Date(entry.start_date).getTime();
    const end = entry.completion_time ? new Date(entry.completion_time).getTime() : start;
    totalMs += Math.max(0, end - start);
  }
  const totalHours = totalMs / (1000 * 60 * 60);
  console.log(`TOTAL_TRACKED_HOURS: ${totalHours.toFixed(2)}`);
}

export async function handleInsights(state: Config, parsed: ParsedArgs, callOpts: ApiCallOptions): Promise<void> {
  const period = (parsed.options.period as Period) || 'last-30-days';
  const format = parsed.options.format ?? 'text';
  
  let periodFrom = parsed.options.from;
  let periodTo = parsed.options.to;
  if (!periodFrom && !periodTo) {
    const window = windowForPeriod(period);
    if (window) {
      periodFrom = window.start;
      periodTo = window.end;
    }
  }
  
  let filter = `user='${state.user_id}' && completion_time!=""`;
  if (periodFrom) filter += ` && start_date>='${periodFrom} 00:00:00'`;
  if (periodTo) filter += ` && start_date<='${periodTo} 23:59:59'`;
  
  const url = `/api/collections/time_entries/records?filter=${encodeURIComponent(filter)}&perPage=100000&sort=-start_date`;
  const response = (await apiCall(state, url, undefined, callOpts)) as {
    items?: Array<{ space: string; specialization?: string; start_date: string; completion_time?: string }>;
  };
  const items = response.items || [];
  
  if (items.length === 0) {
    if (format === 'json') {
      console.log(JSON.stringify({ error: 'No data found' }));
    } else {
      console.log('No tracked sessions found in this period to extract insights.');
    }
    return;
  }

  // Compute metrics
  let focusBlocks = 0;
  const daySwitchesMap = new Map<string, Set<string>>();
  let totalStartMs = 0;
  let totalEndMs = 0;
  let totalMs = 0;
  const spaceMs = new Map<string, number>();

  // For velocity trends: current week vs previous week
  const nowTime = new Date().getTime();
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  let curWeekMs = 0;
  let prevWeekMs = 0;

  for (const item of items) {
    const start = new Date(item.start_date);
    const end = item.completion_time ? new Date(item.completion_time) : start;
    const duration = end.getTime() - start.getTime();
    totalMs += duration;

    if (duration >= 90 * 60 * 1000) {
      focusBlocks++;
    }

    const localDate = formatLocalDate(start);
    if (!daySwitchesMap.has(localDate)) {
      daySwitchesMap.set(localDate, new Set());
    }
    daySwitchesMap.get(localDate)!.add(item.space);

    const startHourMs = (start.getHours() * 3600 + start.getMinutes() * 60 + start.getSeconds()) * 1000;
    const endHourMs = (end.getHours() * 3600 + end.getMinutes() * 60 + end.getSeconds()) * 1000;
    totalStartMs += startHourMs;
    totalEndMs += endHourMs;

    spaceMs.set(item.space, (spaceMs.get(item.space) || 0) + duration);

    // Velocity calculations
    const startEpoch = start.getTime();
    if (startEpoch >= nowTime - oneWeekMs) {
      curWeekMs += duration;
    } else if (startEpoch >= nowTime - 2 * oneWeekMs && startEpoch < nowTime - oneWeekMs) {
      prevWeekMs += duration;
    }
  }

  const activeDays = daySwitchesMap.size || 1;
  let totalSwitches = 0;
  for (const spaces of daySwitchesMap.values()) {
    totalSwitches += Math.max(0, spaces.size - 1);
  }
  const avgContextSwitches = totalSwitches / activeDays;

  const avgStartSec = Math.floor(totalStartMs / items.length / 1000);
  const avgEndSec = Math.floor(totalEndMs / items.length / 1000);
  const formatTimeOfDay = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const spaceRatios: Record<string, number> = {};
  const distributionRows: Array<{ space: string; ratio: number; percent: number }> = [];
  for (const [space, ms] of spaceMs.entries()) {
    const ratio = ms / totalMs;
    spaceRatios[space] = ratio;
    distributionRows.push({ space, ratio, percent: Math.round(ratio * 100) });
  }
  distributionRows.sort((a, b) => b.ratio - a.ratio);

  let velocityChange = 0;
  if (prevWeekMs > 0) {
    velocityChange = ((curWeekMs - prevWeekMs) / prevWeekMs) * 100;
  }

  if (format === 'json') {
    console.log(JSON.stringify({
      period: { from: periodFrom, to: periodTo },
      metrics: {
        focus_blocks: focusBlocks,
        avg_context_switches_per_day: parseFloat(avgContextSwitches.toFixed(1)),
        temporal_core: {
          avg_start: formatTimeOfDay(avgStartSec),
          avg_end: formatTimeOfDay(avgEndSec)
        },
        space_distribution: spaceRatios,
        velocity_trend_percentage: parseFloat(velocityChange.toFixed(1))
      }
    }, null, 2));
    return;
  }

  // Text Output Format Dashboard
  console.log(`=== QADRANT INSIGHTS (${periodFrom} to ${periodTo}) ===\n`);
  console.log('Productivity Patterns:');
  console.log(`- Focus Blocks (>= 90m):  ${focusBlocks} deep session(s)`);
  console.log(`- Context Switches:       ${avgContextSwitches.toFixed(1)} / day`);
  console.log('\nWork Schedule Window:');
  console.log(`- Average Work Day:       ${formatTimeOfDay(avgStartSec)} - ${formatTimeOfDay(avgEndSec)}`);
  console.log('\nSpace Distribution:');
  for (const r of distributionRows) {
    const barLen = Math.round(r.ratio * 10);
    const bar = '█'.repeat(barLen).padEnd(10, '░');
    console.log(`[${bar}] ${r.percent}% ${r.space}`);
  }
  console.log('\nVelocity Trends:');
  const prefix = velocityChange >= 0 ? '+' : '';
  console.log(`- Current Week vs Last:   ${prefix}${velocityChange.toFixed(1)}% active hours`);
}

export async function main() {
  let parsed: ParsedArgs;
  try {
    parsed = parseArgs(process.argv);
  } catch (err) {
    if (err instanceof CliError) {
      console.error(`Error: ${err.message}`);
      process.exit(err.exitCode);
      return;
    }
    throw err;
  }

  if (!parsed.command || parsed.command === 'help') {
    if (parsed.global.noRefresh && parsed.command !== 'help') {
      console.error('Error: --no-refresh must be followed by a subcommand.');
      process.exit(1);
      return;
    }
    printHelp();
    return;
  }

  const callOpts: ApiCallOptions = { noRefresh: parsed.global.noRefresh };

  try {
    switch (parsed.command) {
      case 'login':
        await handleLogin(parsed);
        return;
      case 'logout':
        await handleLogout();
        return;
      case 'whoami':
        await handleWhoami(parsed);
        return;
      case 'aggregate':
        console.error('qadrant: "aggregate" is deprecated. Use "stats --by ..." instead.');
        if (!parsed.options.by) {
          throw new CliError('--by is required for aggregate');
        }
        /* falls through */
      case 'stats': {
        const state = await requireConfig(parsed.options.url);
        await handleStats(state, parsed, callOpts);
        return;
      }
      case 'insights': {
        const state = await requireConfig(parsed.options.url);
        await handleInsights(state, parsed, callOpts);
        return;
      }
      case 'start': {
        const state = await requireConfig(parsed.options.url);
        await handleStart(state, parsed, callOpts);
        return;
      }
      case 'stop': {
        const state = await requireConfig(parsed.options.url);
        await handleStop(state, callOpts);
        return;
      }
      case 'status': {
        const state = await requireConfig(parsed.options.url);
        await handleStatus(state, callOpts);
        return;
      }
      case 'list': {
        const state = await requireConfig(parsed.options.url);
        await handleList(state, parsed, callOpts);
        return;
      }
      default:
        console.error(`Error: Unknown command: ${parsed.command}`);
        printHelp();
        process.exit(1);
        return;
    }
  } catch (err) {
    if (err instanceof CliError) {
      console.error(`Error: ${err.message}`);
      process.exit(err.exitCode);
      return;
    }
    if (err instanceof SessionExpiredError) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
      return;
    }
    if (err instanceof ApiError) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
      return;
    }
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${errMsg}`);
    process.exit(1);
  }
}

if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
