import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import type { Config } from '../types.js';

const CONFIG_FILE = path.join(os.homedir(), '.qadrant', 'config.json');

export async function readConfig(): Promise<Config | null> {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}
