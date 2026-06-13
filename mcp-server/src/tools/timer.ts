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
