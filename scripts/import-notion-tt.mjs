#! /usr/bin/env node
// One-shot import: notion-tt export → qadrant (PocketBase `time_entries`).
// Run with --dry-run first to inspect the mapped records.
//
// Auth: reuses the same `~/.qadrant/config.json` produced by `qadrant login`.
// Idempotent: hashes each source entry, stores successes in .imported.json;
// safe to re-run after a partial failure. --reset wipes the state.

import { readFile, writeFile, rename, mkdir, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const CONFIG_PATH = path.join(os.homedir(), '.qadrant', 'config.json');
const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const STATE_PATH = path.join(SCRIPT_DIR, '.imported.json');
const DEFAULT_EXPORT_DIR = path.join(
  os.homedir(),
  'Code',
  'notion-tt',
  'exports',
);

function parseArgs(argv) {
  const out = {
    exportDir: null,
    url: null,
    dryRun: false,
    batchSize: 5,
    limit: null,
    reset: false,
    verbose: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--reset') out.reset = true;
    else if (a === '--verbose' || a === '-v') out.verbose = true;
    else if (a === '--export') out.exportDir = argv[++i];
    else if (a === '--url') out.url = argv[++i];
    else if (a === '--batch-size') out.batchSize = Math.max(1, parseInt(argv[++i], 10) || 5);
    else if (a === '--limit') out.limit = Math.max(1, parseInt(argv[++i], 10) || 0);
    else if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown flag: ${a}`);
    }
  }
  return out;
}

function printHelp() {
  console.log(`Usage: node scripts/import-notion-tt.mjs [options]

Options:
  --export <dir>         Path to the unzipped export folder
                         (default: latest subfolder of ~/Code/notion-tt/exports)
  --url <pocketbase-url> Override PocketBase URL (default: from ~/.qadrant/config.json)
  --batch-size N         Concurrent POSTs in flight (default 5)
  --limit N              Only import the first N entries
  --dry-run              Map and report; do not POST
  --reset                Wipe .imported.json and re-import everything
  -v, --verbose          Log every record
  -h, --help             Show this help
`);
}

async function resolveExportDir(argDir) {
  if (argDir) {
    if (!existsSync(argDir)) throw new Error(`Export directory not found: ${argDir}`);
    return argDir;
  }
  if (!existsSync(DEFAULT_EXPORT_DIR)) {
    throw new Error(
      `Default export directory not found: ${DEFAULT_EXPORT_DIR}\n` +
        `Pass --export <path> explicitly.`,
    );
  }
  const entries = await readdir(DEFAULT_EXPORT_DIR);
  const dirs = [];
  for (const e of entries) {
    const full = path.join(DEFAULT_EXPORT_DIR, e);
    const s = await stat(full);
    if (s.isDirectory()) dirs.push(full);
  }
  if (dirs.length === 0) throw new Error(`No export folders in ${DEFAULT_EXPORT_DIR}`);
  dirs.sort();
  return dirs[dirs.length - 1];
}

async function loadExport(exportDir) {
  const manifestPath = path.join(exportDir, 'manifest.json');
  const entriesPath = path.join(exportDir, 'entries.json');
  const spacesPath = path.join(exportDir, 'spaces.json');
  for (const p of [manifestPath, entriesPath, spacesPath]) {
    if (!existsSync(p)) throw new Error(`Missing export file: ${p}`);
  }
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.schemaVersion !== 1) {
    throw new Error(`Unsupported schemaVersion ${manifest.schemaVersion}; expected 1.`);
  }
  const entries = JSON.parse(await readFile(entriesPath, 'utf8'));
  const spaces = JSON.parse(await readFile(spacesPath, 'utf8'));
  return { manifest, entries, spaces };
}

async function readCliConfig() {
  if (!existsSync(CONFIG_PATH)) {
    throw new Error(
      `qadrant CLI is not authenticated. Run \`qadrant login <token>\` first.\n` +
        `(Config file not found: ${CONFIG_PATH})`,
    );
  }
  const cfg = JSON.parse(await readFile(CONFIG_PATH, 'utf8'));
  if (!cfg.pb_url || !cfg.auth_token || !cfg.user_id) {
    throw new Error(`Config at ${CONFIG_PATH} is missing pb_url/auth_token/user_id.`);
  }
  return cfg;
}

function hashEntry(source) {
  const canonical = {
    id: source.id,
    taskName: source.taskName,
    spaceName: source.spaceName,
    subtype: source.subtype,
    startTime: source.startTime,
    completionTime: source.completionTime,
  };
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(canonical))
    .digest('hex');
}

function mapToQadrantRow(source, userId) {
  if (!source.completionTime) return null;
  const isPiano = source.spaceName === 'Piano';
  const isKO2 = source.spaceName && source.spaceName.toUpperCase() === 'KO2';
  let specialization = '';

  if (isPiano) {
    specialization = source.subtype && source.subtype.length > 0
      ? source.subtype
      : source.taskName || '';
  } else if (isKO2) {
    specialization = source.subtype && source.subtype.length > 0
      ? source.subtype
      : 'UNICREDIT';
  } else {
    specialization = source.subtype || '';
  }

  return {
    start_date: source.startTime,
    completion_time: source.completionTime,
    space: (source.spaceName || '(no space)').toUpperCase().trim(),
    specialization: specialization.toUpperCase().trim(),
    user: userId,
  };
}

async function loadState(reset) {
  if (reset && existsSync(STATE_PATH)) {
    await rename(STATE_PATH, STATE_PATH + '.bak.' + Date.now());
  }
  if (!existsSync(STATE_PATH)) return {};
  try {
    return JSON.parse(await readFile(STATE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

async function saveState(state) {
  const tmp = STATE_PATH + '.tmp';
  await writeFile(tmp, JSON.stringify(state, null, 2));
  await rename(tmp, STATE_PATH);
}

async function refreshToken(pbUrl, token) {
  const res = await fetch(`${pbUrl}/api/collections/users/auth-refresh`, {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.token) return null;
  return { token: data.token, userId: data.record?.id };
}

async function postEntry(pbUrl, token, row) {
  const res = await fetch(`${pbUrl}/api/collections/time_entries/records`, {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(row),
  });
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, body: text };
  }
  let id = null;
  try {
    id = JSON.parse(text).id;
  } catch {}
  return { ok: true, id };
}

async function postEntryWithRefresh(cfg, row, onTokenRotated) {
  let res = await postEntry(cfg.pb_url, cfg.auth_token, row);
  if (res.status === 401) {
    const rotated = await refreshToken(cfg.pb_url, cfg.auth_token);
    if (rotated) {
      cfg.auth_token = rotated.token;
      if (rotated.userId) cfg.user_id = rotated.userId;
      await writeFile(CONFIG_PATH, JSON.stringify(cfg, null, 2), { mode: 0o600 });
      if (onTokenRotated) await onTokenRotated(cfg);
      res = await postEntry(cfg.pb_url, cfg.auth_token, row);
    }
  }
  return res;
}

async function runWithConcurrency(items, size, worker) {
  const results = new Array(items.length);
  let next = 0;
  const pump = async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  };
  const pumps = Array.from({ length: Math.min(size, items.length) }, pump);
  await Promise.all(pumps);
  return results;
}

function pad(s, n) {
  return String(s).padEnd(n);
}

function truncate(s, n) {
  s = String(s ?? '');
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

function reportMappingSummary(mapped) {
  const bySpace = {};
  const bySpec = {};
  let foldedCount = 0;
  for (const m of mapped) {
    bySpace[m.row.space] = (bySpace[m.row.space] || 0) + 1;
    if (m.usedTaskName) foldedCount++;
    if (m.row.specialization) {
      bySpec[m.row.specialization] = (bySpec[m.row.specialization] || 0) + 1;
    }
  }
  console.log(`\nMapped ${mapped.length} entries.`);
  console.log(`  taskName folded into specialization: ${foldedCount}`);
  console.log(`  spaces:`);
  for (const [name, n] of Object.entries(bySpace).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${pad(truncate(name, 40), 42)} ${n}`);
  }
  console.log(`  specializations (top 15):`);
  const specs = Object.entries(bySpec).sort((a, b) => b[1] - a[1]).slice(0, 15);
  for (const [name, n] of specs) {
    console.log(`    ${pad(truncate(name, 40), 42)} ${n}`);
  }
  if (Object.keys(bySpec).length > 15) {
    console.log(`    …and ${Object.keys(bySpec).length - 15} more`);
  }
  console.log(`\nSample (first 3):`);
  for (const m of mapped.slice(0, 3)) {
    console.log(
      `  ${m.source.startTime} → space=${JSON.stringify(m.row.space)} ` +
        `spec=${JSON.stringify(truncate(m.row.specialization, 50))} ` +
        `task=${JSON.stringify(truncate(m.source.taskName, 50))}`,
    );
  }
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(2);
    return;
  }

  const exportDir = await resolveExportDir(args.exportDir);
  console.log(`Export dir: ${exportDir}`);

  const { manifest, entries } = await loadExport(exportDir);
  console.log(
    `Manifest: ${manifest.counts.entries} entries, ${manifest.counts.spaces} spaces, schema v${manifest.schemaVersion}`,
  );

  const cfg = await readCliConfig();
  const pbUrl = args.url || cfg.pb_url;
  console.log(`PocketBase: ${pbUrl} (user ${cfg.user_id})`);

  const state = await loadState(args.reset);
  if (args.reset) console.log('State reset: re-importing all entries.');

  const mapped = [];
  let skippedNoCompletion = 0;
  for (const e of entries) {
    const row = mapToQadrantRow(e, cfg.user_id);
    if (!row) {
      skippedNoCompletion++;
      continue;
    }
    const hash = hashEntry(e);
    if (state[hash]) continue;
    mapped.push({
      source: e,
      row,
      hash,
      usedTaskName: e.spaceName === 'Piano' && !e.subtype && !!e.taskName,
    });
  }

  reportMappingSummary(mapped);

  const limit = args.limit ? Math.min(args.limit, mapped.length) : mapped.length;
  const toProcess = mapped.slice(0, limit);

  console.log(
    `\nPlan: ${mapped.length} to import, ${entries.length - mapped.length - skippedNoCompletion} already done (state), ` +
      `${skippedNoCompletion} skipped (no completion), processing ${toProcess.length}` +
      (args.dryRun ? ' [DRY RUN]' : '') +
      `.\n`,
  );

  if (args.dryRun) return;

  if (toProcess.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  const t0 = Date.now();
  let imported = 0;
  let failed = 0;
  const failures = [];
  let lastProgress = 0;

  await runWithConcurrency(toProcess, args.batchSize, async (item, i) => {
    let attempts = 0;
    let lastError = null;
    while (attempts < 3) {
      const res = await postEntryWithRefresh(cfg, item.row, async (rotated) => {
        console.log(`  [token rotated] new token ${rotated.auth_token.slice(0, 6)}…${rotated.auth_token.slice(-4)}`);
      });
      if (res.ok) {
        state[item.hash] = {
          id: res.id,
          importedAt: new Date().toISOString(),
        };
        imported++;
        if (args.verbose) {
          console.log(
            `  [${i + 1}/${toProcess.length}] ok ${item.source.startTime} ${item.row.space} :: ${truncate(item.row.specialization, 30)}`,
          );
        }
        lastError = null;
        break;
      }
      lastError = res;
      if (res.status >= 500 || res.status === 429) {
        attempts++;
        const wait = 200 * Math.pow(2, attempts);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      break;
    }
    if (lastError && !state[item.hash]) {
      failed++;
      failures.push({
        index: i,
        status: lastError.status,
        body: lastError.body,
        row: item.row,
        source: item.source,
      });
      if (args.verbose) {
        console.log(`  [${i + 1}/${toProcess.length}] FAIL status=${lastError.status} body=${truncate(lastError.body, 200)}`);
      }
    }
    if (imported + failed > lastProgress + 49) {
      lastProgress = imported + failed;
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(
        `  [progress ${lastProgress}/${toProcess.length}] imported=${imported} failed=${failed} elapsed=${elapsed}s`,
      );
      await saveState(state);
    }
  });

  await saveState(state);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(
    `\nDone in ${elapsed}s. Imported: ${imported}. Failed: ${failed}. Skipped (state): ${entries.length - mapped.length - skippedNoCompletion}.`,
  );
  if (failures.length) {
    console.log(`\nFailures (${failures.length}):`);
    for (const f of failures.slice(0, 10)) {
      console.log(
        `  status=${f.status} row=${JSON.stringify({ start_date: f.row.start_date, space: f.row.space, specialization: f.row.specialization })} body=${truncate(f.body, 200)}`,
      );
    }
    if (failures.length > 10) console.log(`  …and ${failures.length - 10} more`);
  }
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  if (process.env.DEBUG) console.error(err);
  process.exit(1);
});
