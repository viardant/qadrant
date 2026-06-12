import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseArgs, readConfig, writeConfig } from './index.js';
import fs from 'fs/promises';

vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
  }
}));

describe('CLI Argument Parsing', () => {
  it('should parse login command with token and custom url', () => {
    const parsed = parseArgs(['node', 'qadrant', 'login', 'my-token', '--url', 'https://example.com']);
    expect(parsed.command).toBe('login');
    expect(parsed.args[0]).toBe('my-token');
    expect(parsed.options.url).toBe('https://example.com');
  });

  it('should parse start command with task, space and sub specialization', () => {
    const parsed = parseArgs([
      'node',
      'qadrant',
      'start',
      'Coding task 7',
      '--space',
      'engineering',
      '--sub',
      'frontend'
    ]);
    expect(parsed.command).toBe('start');
    expect(parsed.args[0]).toBe('Coding task 7');
    expect(parsed.options.space).toBe('engineering');
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

describe('Config File Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should write config to the path correctly', async () => {
    await writeConfig({ pb_url: 'http://localhost:8090', auth_token: 'tok123', user_id: 'usr456' });
    expect(fs.mkdir).toHaveBeenCalled();
    expect(fs.writeFile).toHaveBeenCalled();
  });

  it('should read config from the path correctly', async () => {
    vi.mocked(fs.readFile).mockResolvedValueOnce(
      JSON.stringify({ pb_url: 'http://localhost:8090', auth_token: 'tok123', user_id: 'usr456' })
    );
    const config = await readConfig();
    expect(config).toEqual({ pb_url: 'http://localhost:8090', auth_token: 'tok123', user_id: 'usr456' });
  });
});
