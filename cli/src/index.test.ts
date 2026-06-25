import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseArgs,
  readConfig,
  writeConfig,
  apiCall,
  handleLogin,
  handleLogout,
  handleWhoami,
  ApiError,
  SessionExpiredError,
  CliError,
  parseRelativeDateOrPreset,
  parseDurationToMs,
} from './index.js';
import fs from 'fs/promises';

vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    unlink: vi.fn(),
    chmod: vi.fn(),
  }
}));

describe('CLI Argument Parsing', () => {
  it('should parse login command with token and custom url', () => {
    const parsed = parseArgs(['node', 'qadrant', 'login', 'my-token', '--url', 'https://example.com']);
    expect(parsed.command).toBe('login');
    expect(parsed.args[0]).toBe('my-token');
    expect(parsed.options.url).toBe('https://example.com');
  });

  it('should parse start command with space and sub specialization', () => {
    const parsed = parseArgs([
      'node', 'qadrant', 'start', 'engineering', '--sub', 'frontend'
    ]);
    expect(parsed.command).toBe('start');
    expect(parsed.args[0]).toBe('engineering');
    expect(parsed.options.sub).toBe('frontend');
  });

  it('should parse stop command', () => {
    const parsed = parseArgs(['node', 'qadrant', 'stop']);
    expect(parsed.command).toBe('stop');
  });

  it('should parse status command', () => {
    const parsed = parseArgs(['node', 'qadrant', 'status']);
    expect(parsed.command).toBe('status');
  });

  it('should parse list command with limit', () => {
    const parsed = parseArgs(['node', 'qadrant', 'list', '--limit', '10']);
    expect(parsed.command).toBe('list');
    expect(parsed.options.limit).toBe(10);
  });
});

describe('CLI Argument Parsing - aggregation flags', () => {
  it('parses --by, --period, --format together', () => {
    const parsed = parseArgs([
      'node', 'qadrant', 'aggregate',
      '--by', 'space', '--period', 'this-month', '--format', 'json',
    ]);
    expect(parsed.command).toBe('aggregate');
    expect(parsed.options.by).toBe('space');
    expect(parsed.options.period).toBe('this-month');
    expect(parsed.options.format).toBe('json');
  });

  it('parses --by and --format on stats', () => {
    const parsed = parseArgs([
      'node', 'qadrant', 'stats',
      '--by', 'day', '--period', 'today', '--format', 'text',
    ]);
    expect(parsed.command).toBe('stats');
    expect(parsed.options.by).toBe('day');
    expect(parsed.options.period).toBe('today');
    expect(parsed.options.format).toBe('text');
  });

  it('leaves new options undefined when omitted', () => {
    const parsed = parseArgs(['node', 'qadrant', 'list', '--limit', '5']);
    expect(parsed.options.by).toBeUndefined();
    expect(parsed.options.period).toBeUndefined();
    expect(parsed.options.format).toBeUndefined();
  });
});

describe('CLI Argument Parsing - new stats flags', () => {
  it('parses --from and --to', () => {
    const parsed = parseArgs([
      'node', 'qadrant', 'stats',
      '--from', '2024-01-01', '--to', '2024-01-31',
    ]);
    expect(parsed.options.from).toBe('2024-01-01');
    expect(parsed.options.to).toBe('2024-01-31');
  });

  it('parses --space and --spec on stats', () => {
    const parsed = parseArgs([
      'node', 'qadrant', 'stats',
      '--space', 'engineering', '--spec', 'frontend',
    ]);
    expect(parsed.options.space).toBe('engineering');
    expect(parsed.options.spec).toBe('frontend');
  });

  it('parses --include-entries flag', () => {
    const parsed = parseArgs([
      'node', 'qadrant', 'stats',
      '--by', 'space', '--include-entries',
    ]);
    expect(parsed.options.includeEntries).toBe(true);
  });
});

describe('CLI Argument Parsing - new list flags', () => {
  it('parses --space and --spec on list', () => {
    const parsed = parseArgs([
      'node', 'qadrant', 'list',
      '--space', 'engineering', '--spec', 'backend',
    ]);
    expect(parsed.options.space).toBe('engineering');
    expect(parsed.options.spec).toBe('backend');
  });

  it('parses --offset flag', () => {
    const parsed = parseArgs(['node', 'qadrant', 'list', '--offset', '20']);
    expect(parsed.options.offset).toBe(20);
  });

  it('parses --from, --to, --format json on list', () => {
    const parsed = parseArgs([
      'node', 'qadrant', 'list',
      '--from', '2024-06-01', '--to', '2024-06-30', '--format', 'json',
    ]);
    expect(parsed.options.from).toBe('2024-06-01');
    expect(parsed.options.to).toBe('2024-06-30');
    expect(parsed.options.format).toBe('json');
  });
});

describe('CLI Argument Parsing - global flags', () => {
  it('parses --no-refresh before subcommand', () => {
    const parsed = parseArgs(['node', 'qadrant', '--no-refresh', 'start', 'work']);
    expect(parsed.command).toBe('start');
    expect(parsed.global.noRefresh).toBe(true);
    expect(parsed.args).toEqual(['work']);
  });

  it('rejects --no-refresh after the subcommand', () => {
    expect(() => parseArgs(['node', 'qadrant', 'start', 'work', '--no-refresh']))
      .toThrow(CliError);
  });

  it('parses --url as a global override before the subcommand', () => {
    const parsed = parseArgs(['node', 'qadrant', '--url', 'https://override.example', 'start', 'work']);
    expect(parsed.command).toBe('start');
    expect(parsed.options.url).toBe('https://override.example');
  });

  it('parses --url as a per-command flag after the subcommand', () => {
    const parsed = parseArgs(['node', 'qadrant', 'start', 'work', '--url', 'https://x.example']);
    expect(parsed.options.url).toBe('https://x.example');
  });

  it('rejects unknown flag before the subcommand', () => {
    expect(() => parseArgs(['node', 'qadrant', '--bogus', 'start']))
      .toThrow(/Unknown flag: --bogus/);
  });

  it('rejects unknown flag after the subcommand', () => {
    expect(() => parseArgs(['node', 'qadrant', 'start', 'work', '--bogus']))
      .toThrow(/Unknown flag: --bogus/);
  });

  it('rejects global flag without a subcommand', () => {
    expect(() => parseArgs(['node', 'qadrant', '--no-refresh']))
      .toThrow(/A subcommand is required/);
    expect(() => parseArgs(['node', 'qadrant', '--url', 'https://x.example']))
      .toThrow(/A subcommand is required/);
  });

  it('accepts the new commands whoami and logout', () => {
    expect(parseArgs(['node', 'qadrant', 'whoami']).command).toBe('whoami');
    expect(parseArgs(['node', 'qadrant', 'logout']).command).toBe('logout');
  });

  it('rejects invalid limit or offset values with CliError', () => {
    expect(() => parseArgs(['node', 'qadrant', 'list', '--limit', 'foo']))
      .toThrow(/Value for flag --limit must be an integer/);
    expect(() => parseArgs(['node', 'qadrant', 'list', '--offset', 'bar']))
      .toThrow(/Value for flag --offset must be an integer/);
  });

  it('parses --help, -h, and help commands to show help', () => {
    expect(parseArgs(['node', 'qadrant', '--help']).command).toBe('help');
    expect(parseArgs(['node', 'qadrant', '-h']).command).toBe('help');
    expect(parseArgs(['node', 'qadrant', 'help']).command).toBe('help');
    expect(parseArgs(['node', 'qadrant', 'start', '--help']).command).toBe('help');
  });
});

describe('Config File Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should write config to the path correctly', async () => {
    await writeConfig({ pb_url: 'http://localhost:8090', auth_token: 'tok123', user_id: 'usr456' });
    expect(fs.mkdir).toHaveBeenCalled();
    expect(fs.writeFile).toHaveBeenCalled();
  });

  it('should write config with restrictive permissions', async () => {
    await writeConfig({ pb_url: 'http://localhost:8090', auth_token: 'tok123', user_id: 'usr456' });
    expect(fs.chmod).toHaveBeenCalledWith(expect.any(String), 0o600);
  });

  it('should read config from the path correctly', async () => {
    vi.mocked(fs.readFile).mockResolvedValueOnce(
      JSON.stringify({ pb_url: 'http://localhost:8090', auth_token: 'tok123', user_id: 'usr456' })
    );
    const config = await readConfig();
    expect(config).toEqual({ pb_url: 'http://localhost:8090', auth_token: 'tok123', user_id: 'usr456' });
  });

  it('returns null when config is missing required fields', async () => {
    vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify({ pb_url: '', auth_token: '', user_id: '' }));
    const config = await readConfig();
    expect(config).toBeNull();
  });
});

describe('apiCall - transparent token refresh', () => {
  const baseState = { pb_url: 'https://pb.example', auth_token: 'old-token', user_id: 'user-1' };

  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the parsed body on a 200 response', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ items: [] }),
      text: async () => '',
    });
    const result = await apiCall(baseState, '/api/collections/time_entries/records');
    expect(result).toEqual({ items: [] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://pb.example/api/collections/time_entries/records');
  });

  it('refreshes the token on 401, persists it, and retries the original call', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'token has expired',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ token: 'new-token', record: { id: 'user-1' } }),
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
        text: async () => '',
      });

    const state = { ...baseState };
    const result = await apiCall(state, '/api/collections/time_entries/records', { method: 'POST' });

    expect(result).toEqual({ ok: true });
    expect(state.auth_token).toBe('new-token');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toContain('/api/collections/users/auth-refresh');
    expect(fs.writeFile).toHaveBeenCalled();
    const written = JSON.parse(vi.mocked(fs.writeFile).mock.calls[0][1] as string);
    expect(written.auth_token).toBe('new-token');
  });

  it('throws SessionExpiredError when refresh also fails', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'expired',
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'cannot refresh',
      });

    const state = { ...baseState };
    await expect(apiCall(state, '/api/collections/time_entries/records'))
      .rejects.toBeInstanceOf(SessionExpiredError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws SessionExpiredError on 401 when --no-refresh is set, without calling refresh', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'expired',
    });

    const state = { ...baseState };
    await expect(apiCall(state, '/api/collections/time_entries/records', {}, { noRefresh: true }))
      .rejects.toBeInstanceOf(SessionExpiredError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws ApiError on non-auth failures (e.g. 500) and does not attempt refresh', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'server error',
    });

    const state = { ...baseState };
    try {
      await apiCall(state, '/api/collections/time_entries/records');
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(500);
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('invokes onTokenRotated when a refresh rotates the token', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'unauthorized' })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ token: 'rotated', record: { id: 'user-1' } }), text: async () => '' })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}), text: async () => '' });

    const state = { ...baseState };
    const onRotated = vi.fn();
    await apiCall(state, '/api/records', {}, { onTokenRotated: onRotated });
    expect(onRotated).toHaveBeenCalledOnce();
    expect(onRotated.mock.calls[0][0].auth_token).toBe('rotated');
  });

  it('throws ApiError on 403 status (does not attempt token refresh)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => 'forbidden API rule',
    });

    const state = { ...baseState };
    await expect(apiCall(state, '/api/collections/time_entries/records'))
      .rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('handleLogin', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('refreshes the token, persists config, and prints success', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ token: 'new-tok', record: { id: 'user-1' } }),
      text: async () => '',
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await handleLogin({
      global: { noRefresh: false },
      command: 'login',
      args: ['old-tok'],
      options: { url: 'https://pb.example' },
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe('https://pb.example/api/collections/users/auth-refresh');
    expect(fs.writeFile).toHaveBeenCalledOnce();
    const written = JSON.parse(vi.mocked(fs.writeFile).mock.calls[0][1] as string);
    expect(written).toEqual({ pb_url: 'https://pb.example', auth_token: 'new-tok', user_id: 'user-1' });
    expect(logSpy).toHaveBeenCalledWith('LOGIN_SUCCESSFUL_AUTHENTICATED');

    logSpy.mockRestore();
  });

  it('throws when no token is provided', async () => {
    await expect(handleLogin({
      global: { noRefresh: false },
      command: 'login',
      args: [],
      options: {},
    })).rejects.toThrow(CliError);
  });

  it('throws when the server rejects the token', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'invalid',
    });
    await expect(handleLogin({
      global: { noRefresh: false },
      command: 'login',
      args: ['bad-tok'],
      options: { url: 'https://pb.example' },
    })).rejects.toThrow(/token was rejected/);
  });
});

describe('handleLogout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes the config file and prints LOGOUT_PROTOCOL', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await handleLogout();
    expect(fs.unlink).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith('LOGOUT_PROTOCOL');
    logSpy.mockRestore();
  });

  it('does not throw when the config file does not exist', async () => {
    const err = Object.assign(new Error('not found'), { code: 'ENOENT' });
    vi.mocked(fs.unlink).mockRejectedValueOnce(err);
    await expect(handleLogout()).resolves.toBeUndefined();
  });
});

describe('handleWhoami', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeJwt(payload: Record<string, unknown>): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${header}.${body}.signature`;
  }

  it('throws when not authenticated', async () => {
    vi.mocked(fs.readFile).mockRejectedValueOnce(new Error('ENOENT'));
    await expect(handleWhoami({
      global: { noRefresh: false },
      command: 'whoami',
      args: [],
      options: {},
    })).rejects.toThrow(CliError);
  });

  it('prints a masked token and decoded exp in plain text', async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = makeJwt({ exp, sub: 'user-1' });
    vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify({
      pb_url: 'https://pb.example',
      auth_token: token,
      user_id: 'user-1',
    }));
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await handleWhoami({
      global: { noRefresh: false },
      command: 'whoami',
      args: [],
      options: {},
    });

    const output = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('pb_url:     https://pb.example');
    expect(output).toContain('user_id:    user-1');
    expect(output).toMatch(/auth_token: [A-Za-z0-9_-]+…[A-Za-z0-9_-]+/);
    expect(output).toContain('expires_at:');
    logSpy.mockRestore();
  });

  it('emits JSON when --format json is set', async () => {
    const token = makeJwt({ exp: 1234567890 });
    vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify({
      pb_url: 'https://pb.example',
      auth_token: token,
      user_id: 'user-1',
    }));
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await handleWhoami({
      global: { noRefresh: false },
      command: 'whoami',
      args: [],
      options: { format: 'json' },
    });

    const output = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.user_id).toBe('user-1');
    expect(parsed.expires_at).toBe('2009-02-13T23:31:30.000Z');
    expect(parsed.auth_token).toMatch(/^[A-Za-z0-9_-]+…[A-Za-z0-9_-]+$/);
    logSpy.mockRestore();
  });
});

describe('Helper Utilities', () => {
  const formatLocalDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  it('parseRelativeDateOrPreset parses today, yesterday, and relative times', () => {
    const today = formatLocalDate(new Date());
    expect(parseRelativeDateOrPreset('today')).toBe(today);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatLocalDate(yesterday);
    expect(parseRelativeDateOrPreset('yesterday')).toBe(yesterdayStr);

    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const twoDaysAgoStr = formatLocalDate(twoDaysAgo);
    expect(parseRelativeDateOrPreset('2 days ago')).toBe(twoDaysAgoStr);
  });

  it('parses input dates with leading or trailing whitespace', () => {
    expect(parseRelativeDateOrPreset(' 2026-06-25 ')).toBe('2026-06-25');
  });

  it('parseDurationToMs parses shorthand durations', () => {
    expect(parseDurationToMs('30s')).toBe(30 * 1000);
    expect(parseDurationToMs('5m')).toBe(5 * 60 * 1000);
    expect(parseDurationToMs('1.5h')).toBe(1.5 * 60 * 60 * 1000);
  });

  it('throws error for invalid date or duration formats', () => {
    expect(() => parseRelativeDateOrPreset('invalid')).toThrow();
    expect(() => parseDurationToMs('10x')).toThrow();
  });
});
