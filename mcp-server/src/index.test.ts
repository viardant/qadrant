import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockReadFile, mockFetch } = vi.hoisted(() => ({
  mockReadFile: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  default: { readFile: mockReadFile },
}));

global.fetch = mockFetch;

import { readConfig } from './services/config.js';
import { apiCall } from './services/api-client.js';
import { startTimer, stopTimer, getActiveTimer } from './tools/timer.js';
import { listEntries } from './tools/entries.js';
import { getStats } from './tools/stats.js';
import { qadrantAggregate } from './tools/aggregate-handler.js';
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
        json: async () => ({ items: [{ id: 'rec1', space: 'Work', specialization: 'Debug', start_date: new Date().toISOString() }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({})
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

  it('handles space and date filters', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [{ id: '1', space: 'Work', specialization: 'Test', start_date: new Date().toISOString(), completion_time: new Date().toISOString() }],
        totalItems: 1,
      }),
    });

    const result = await listEntries(makeConfig(), {
      limit: 10,
      offset: 0,
      response_format: ResponseFormat.JSON,
      space: 'Work',
      from: '2026-06-01',
      to: '2026-06-30',
    });

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain(encodeURIComponent("space='Work'"));
    expect(calledUrl).toContain(encodeURIComponent("start_date>='2026-06-01T00:00:00'"));

    const parsed = JSON.parse(result.text);
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.status).toBe('entries_listed');
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

    const result = await getStats(makeConfig(), { response_format: ResponseFormat.MARKDOWN, period: 'all' });
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

    const result = await getStats(makeConfig(), { response_format: ResponseFormat.MARKDOWN, period: 'all' });
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

    const result = await getStats(makeConfig(), { response_format: ResponseFormat.JSON, period: 'all' });
    const parsed = JSON.parse(result.text);
    expect(parsed.stats.total_hours).toBeCloseTo(1.5);
    expect(parsed.status).toBe('stats_computed');
  });

  it('returns grouped stats when by is provided', async () => {
    const start = '2026-06-15T10:00:00.000Z';
    const end = '2026-06-15T12:00:00.000Z';
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [
          { id: '1', space: 'Work', specialization: '', start_date: start, completion_time: end },
        ],
        totalItems: 1,
      }),
    });

    const result = await getStats(makeConfig(), {
      by: 'space',
      period: 'all',
      response_format: ResponseFormat.MARKDOWN,
    });
    expect(result.text).toContain('DIMENSION: SPACE');
    expect(result.text).toContain('Work');
    expect(result.structured.status).toBe('stats_aggregated');
  });

  it('filters entries by space in the API call', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [{ id: '1', space: 'Work', specialization: '', start_date: new Date().toISOString(), completion_time: new Date().toISOString() }],
        totalItems: 1,
      }),
    });

    const result = await getStats(makeConfig(), { by: 'space', space: 'Work', period: 'all', response_format: ResponseFormat.JSON });
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain(encodeURIComponent("space='Work'"));

    const parsed = JSON.parse(result.text);
    expect(parsed.aggregate.rows).toHaveLength(1);
    expect(parsed.aggregate.rows[0].key).toBe('Work');
  });

  it('includes entries when include_entries is true', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [{ id: '1', space: 'Work', specialization: 'Code', start_date: new Date().toISOString(), completion_time: new Date().toISOString() }],
        totalItems: 1,
      }),
    });

    const result = await getStats(makeConfig(), { by: 'space', period: 'all', include_entries: true, response_format: ResponseFormat.JSON });
    const parsed = JSON.parse(result.text);
    expect(parsed.aggregate.rows[0].entries).toBeDefined();
    expect(parsed.aggregate.rows[0].entries).toHaveLength(1);
    expect(parsed.aggregate.rows[0].entries[0].id).toBe('1');
  });

  it('handles custom date range with from/to', async () => {
    const start = '2026-06-15T10:00:00.000Z';
    const end = '2026-06-15T12:00:00.000Z';
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [{ id: '1', space: 'Work', specialization: '', start_date: start, completion_time: end }],
        totalItems: 1,
      }),
    });

    const result = await getStats(makeConfig(), { by: 'space', from: '2026-06-01', to: '2026-06-30', response_format: ResponseFormat.JSON });
    const parsed = JSON.parse(result.text);
    expect(parsed.aggregate.period).toBe('custom');
    expect(parsed.aggregate.window).toEqual({ start: '2026-06-01', end: '2026-06-30' });
  });
});

describe('qadrantAggregate (deprecated)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('works as deprecation alias with warning', async () => {
    const start = '2026-06-15T10:00:00.000Z';
    const end = '2026-06-15T12:00:00.000Z';
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [{ id: '1', space: 'Work', specialization: 'frontend', start_date: start, completion_time: end }],
        totalItems: 1,
      }),
    });

    const result = await qadrantAggregate(makeConfig(), {
      by: 'space',
      period: 'all',
      response_format: ResponseFormat.MARKDOWN,
    });
    expect(result.text).toContain('Deprecated');
    expect(result.text).toContain('DIMENSION: SPACE');
    expect(result.structured.status).toBe('aggregate_computed');
  });
});
