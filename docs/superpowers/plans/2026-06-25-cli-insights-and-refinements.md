# CLI Insights & Advanced Filtering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement relative date/duration parsers, enhance list and stats subcommands, and build a new insights telemetry subcommand.

**Architecture:** We extend the Node.js CLI argument parser and command router. All filters (date offsets, min-duration) and aggregations (grouping by day-of-week/hour-of-day, context switches, focus blocks) are calculated client-side after retrieving the raw timeline data from PocketBase.

**Tech Stack:** TypeScript, Node.js (fs/promises, fetch), Vitest.

---

### Task 1: Parser & Helper Utilities

**Files:**
- Modify: [cli/src/index.ts](file:///Users/viardant/Code/qadrant/cli/src/index.ts) (Add helper utility exports before `parseArgs`)
- Test: [cli/src/index.test.ts](file:///Users/viardant/Code/qadrant/cli/src/index.test.ts) (Add helper test cases)

- [ ] **Step 1: Write the failing test**
  Add the following block to [cli/src/index.test.ts](file:///Users/viardant/Code/qadrant/cli/src/index.test.ts):
  ```typescript
  describe('Helper Utilities', () => {
    it('parseRelativeDateOrPreset parses today, yesterday, and relative times', () => {
      const today = new Date().toISOString().slice(0, 10);
      expect(parseRelativeDateOrPreset('today')).toBe(today);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);
      expect(parseRelativeDateOrPreset('yesterday')).toBe(yesterdayStr);

      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const twoDaysAgoStr = twoDaysAgo.toISOString().slice(0, 10);
      expect(parseRelativeDateOrPreset('2 days ago')).toBe(twoDaysAgoStr);
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
  ```
  Ensure `parseRelativeDateOrPreset` and `parseDurationToMs` are added to the imports at the top of [cli/src/index.test.ts](file:///Users/viardant/Code/qadrant/cli/src/index.test.ts).

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test` inside `cli` directory.
  Expected: FAIL (Cannot find names `parseRelativeDateOrPreset` and `parseDurationToMs`).

- [ ] **Step 3: Write minimal implementation**
  Add these functions to [cli/src/index.ts](file:///Users/viardant/Code/qadrant/cli/src/index.ts) right above `export function parseArgs`:
  ```typescript
  export function parseRelativeDateOrPreset(input: string): string {
    const normalized = input.trim().toLowerCase();
    if (normalized === 'today') {
      return new Date().toISOString().slice(0, 10);
    }
    if (normalized === 'yesterday') {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d.toISOString().slice(0, 10);
    }
    const relativeMatch = normalized.match(/^(\d+)\s+(day|week|month)s?\s+ago$/);
    if (relativeMatch) {
      const count = parseInt(relativeMatch[1], 10);
      const unit = relativeMatch[2];
      const d = new Date();
      if (unit === 'day') d.setDate(d.getDate() - count);
      if (unit === 'week') d.setDate(d.getDate() - count * 7);
      if (unit === 'month') d.setMonth(d.getMonth() - count);
      return d.toISOString().slice(0, 10);
    }
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(input)) {
      throw new CliError(`Invalid date format "${input}". Use YYYY-MM-DD, "today", "yesterday", or "N days/weeks/months ago".`);
    }
    return input;
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
  ```

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm test` inside `cli` directory.
  Expected: PASS.

- [ ] **Step 5: Commit**
  Run:
  ```bash
  git add cli/src/index.ts cli/src/index.test.ts
  git commit -m "feat(cli): add relative date and duration parser helpers"
  ```

---

### Task 2: `list` Subcommand Enhancements

**Files:**
- Modify: [cli/src/index.ts](file:///Users/viardant/Code/qadrant/cli/src/index.ts) (Update `ParsedArgs` interface, `PER_COMMAND_FLAGS`, parser logic, and `handleList` execution flow)
- Test: [cli/src/index.test.ts](file:///Users/viardant/Code/qadrant/cli/src/index.test.ts) (Add tests for `--min-duration`, `--ignore-spec`, and `--dedup`)

- [ ] **Step 1: Write the failing test**
  Add the following tests under `describe('CLI Argument Parsing', ...)` in [cli/src/index.test.ts](file:///Users/viardant/Code/qadrant/cli/src/index.test.ts):
  ```typescript
  it('parses --min-duration, --dedup, and --ignore-spec', () => {
    const parsed = parseArgs(['node', 'qadrant', 'list', '--min-duration', '5m', '--dedup', '--ignore-spec']);
    expect(parsed.options.minDuration).toBe('5m');
    expect(parsed.options.dedup).toBe(true);
    expect(parsed.options.ignoreSpec).toBe(true);
  });
  ```
  And add a behavioral mock test for `handleList` inside [cli/src/index.test.ts](file:///Users/viardant/Code/qadrant/cli/src/index.test.ts) verifying the filtering and squashing of records.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test` inside `cli` directory.
  Expected: FAIL (flags not recognized / parsed options properties undefined).

- [ ] **Step 3: Write minimal implementation**
  1. Update `ParsedArgs` interface options:
     ```typescript
     minDuration?: string;
     dedup?: boolean;
     ignoreSpec?: boolean;
     ```
  2. Add new flags to parser structures:
     ```typescript
     const PER_COMMAND_FLAGS = new Set([
       '--url', '--space', '--sub', '--spec',
       '--limit', '--by', '--period', '--format',
       '--from', '--to', '--offset', '--min-duration',
     ]);
     ```
     Inside `parseArgs` second pass, add checks for boolean flags:
     ```typescript
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
     ```
     Inside `applyOption`, add:
     ```typescript
        case '--min-duration': opts.minDuration = value; break;
        case '--from': opts.from = parseRelativeDateOrPreset(value); break;
        case '--to': opts.to = parseRelativeDateOrPreset(value); break;
     ```
  3. Refactor `handleList` inside [cli/src/index.ts](file:///Users/viardant/Code/qadrant/cli/src/index.ts#L441):
     * Parse and filter by `--min-duration`:
       ```typescript
       let entries = response.items || [];
       if (parsed.options.minDuration) {
         const minMs = parseDurationToMs(parsed.options.minDuration);
         entries = entries.filter(e => {
           const endMs = e.completion_time ? new Date(e.completion_time).getTime() : new Date(e.start_date).getTime();
           const durationMs = endMs - new Date(e.start_date).getTime();
           return durationMs >= minMs;
         });
       }
       ```
     * Apply `--ignore-spec`:
       ```typescript
       if (parsed.options.ignoreSpec) {
         entries = entries.map(e => ({ ...e, specialization: '' }));
       }
       ```
     * Apply `--dedup`:
       ```typescript
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
         return;
       }
       ```

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm test` inside `cli` directory.
  Expected: PASS.

- [ ] **Step 5: Commit**
  Run:
  ```bash
  git add cli/src/index.ts cli/src/index.test.ts
  git commit -m "feat(cli): support list subcommand filters (min-duration, ignore-spec, dedup)"
  ```

---

### Task 3: `stats` Subcommand Enhancements

**Files:**
- Modify: [cli/src/index.ts](file:///Users/viardant/Code/qadrant/cli/src/index.ts) (Extend `--period` calculation and add `hour-of-day` and `day-of-week` groupings in `handleStats`)
- Test: [cli/src/index.test.ts](file:///Users/viardant/Code/qadrant/cli/src/index.test.ts) (Add tests asserting groupings and presets)

- [ ] **Step 1: Write the failing test**
  Add unit tests validating `stats` option parsing and verification checks for newly allowed periods and groupings:
  ```typescript
  it('allows hour-of-day and day-of-week groupings in stats', () => {
    const parsed = parseArgs(['node', 'qadrant', 'stats', '--by', 'hour-of-day', '--period', 'last-week']);
    expect(parsed.options.by).toBe('hour-of-day');
    expect(parsed.options.period).toBe('last-week');
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test` inside `cli` directory.
  Expected: FAIL (invalid values in switch validation checks).

- [ ] **Step 3: Write minimal implementation**
  1. Update validation bounds in `handleStats`:
     ```typescript
     if (by !== undefined && !['space', 'combo', 'day', 'week', 'month', 'hour-of-day', 'day-of-week'].includes(by)) {
       throw new CliError('--by must be one of space|combo|day|week|month|hour-of-day|day-of-week');
     }
     if (period !== undefined && !['today', 'this-week', 'this-month', 'all', 'yesterday', 'last-week', 'last-month', 'last-30-days'].includes(period)) {
       throw new CliError('--period must be one of today|this-week|this-month|all|yesterday|last-week|last-month|last-30-days');
     }
     ```
  2. Implement date calculation presets inside `handleStats` before query creation:
     * If `--period` is set, dynamically calculate `from` and `to` date strings.
     ```typescript
     let periodFrom = parsed.options.from;
     let periodTo = parsed.options.to;
     if (period && !periodFrom && !periodTo) {
       const today = new Date();
       if (period === 'today') {
         periodFrom = periodTo = today.toISOString().slice(0, 10);
       } else if (period === 'yesterday') {
         const y = new Date();
         y.setDate(y.getDate() - 1);
         periodFrom = periodTo = y.toISOString().slice(0, 10);
       } else if (period === 'this-week') {
         const day = today.getDay();
         const diff = today.getDate() - day + (day === 0 ? -6 : 1);
         const monday = new Date(today.setDate(diff));
         periodFrom = monday.toISOString().slice(0, 10);
         periodTo = new Date().toISOString().slice(0, 10);
       } else if (period === 'last-week') {
         const d = new Date();
         const day = d.getDay();
         const diffToLastMonday = d.getDate() - day - 6 + (day === 0 ? -6 : 1);
         const lastMonday = new Date(d.setDate(diffToLastMonday));
         const lastSunday = new Date(d.setDate(lastMonday.getDate() + 6));
         periodFrom = lastMonday.toISOString().slice(0, 10);
         periodTo = lastSunday.toISOString().slice(0, 10);
       } else if (period === 'this-month') {
         periodFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
         periodTo = today.toISOString().slice(0, 10);
       } else if (period === 'last-month') {
         const lm = new Date(today.getFullYear(), today.getMonth() - 1, 1);
         periodFrom = lm.toISOString().slice(0, 10);
         periodTo = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().slice(0, 10);
       } else if (period === 'last-30-days') {
         const d = new Date();
         d.setDate(d.getDate() - 30);
         periodFrom = d.toISOString().slice(0, 10);
         periodTo = new Date().toISOString().slice(0, 10);
       }
     }
     ```
     Update query filter variable using `periodFrom` and `periodTo`.
  3. Implement custom local grouping for `hour-of-day` and `day-of-week` if selected:
     ```typescript
     if (by === 'hour-of-day' || by === 'day-of-week') {
       const groupMap = new Map<string, number>();
       for (const entry of entries) {
         const date = new Date(entry.start_date);
         const groupKey = by === 'hour-of-day'
           ? `${String(date.getHours()).padStart(2, '0')}:00`
           : date.toLocaleDateString('en-US', { weekday: 'long' });
         
         const end = entry.completion_time ? new Date(entry.completion_time).getTime() : date.getTime();
         const durationMs = Math.max(0, end - date.getTime());
         groupMap.set(groupKey, (groupMap.get(groupKey) || 0) + durationMs);
       }
       const rows = Array.from(groupMap.entries()).map(([key, ms]) => ({
         key,
         hours: ms / (1000 * 60 * 60),
       }));
       if (format === 'json') {
         console.log(JSON.stringify(rows, null, 2));
       } else {
         console.log('GROUP        | HOURS');
         console.log('-------------+-------');
         for (const r of rows) {
           console.log(`${r.key.padEnd(12)} | ${r.hours.toFixed(2)}`);
         }
       }
       return;
     }
     ```

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm test` inside `cli` directory.
  Expected: PASS.

- [ ] **Step 5: Commit**
  Run:
  ```bash
  git add cli/src/index.ts cli/src/index.test.ts
  git commit -m "feat(cli): extend stats subcommand period and grouping options"
  ```

---

### Task 4: New `insights` Subcommand

**Files:**
- Modify: [cli/src/index.ts](file:///Users/viardant/Code/qadrant/cli/src/index.ts) (Implement `handleInsights` and register `'insights'` command router)
- Test: [cli/src/index.test.ts](file:///Users/viardant/Code/qadrant/cli/src/index.test.ts) (Add tests asserting insights calculation output)

- [ ] **Step 1: Write the failing test**
  Add unit tests validating `insights` parsing and calculating correctness:
  ```typescript
  it('parses insights command', () => {
    const parsed = parseArgs(['node', 'qadrant', 'insights', '--period', 'last-30-days']);
    expect(parsed.command).toBe('insights');
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test` inside `cli` directory.
  Expected: FAIL (command not matched, throws unknown command error).

- [ ] **Step 3: Write minimal implementation**
  1. Add `insights` to the list of commands in `printHelp()`.
  2. Implement `handleInsights`:
     ```typescript
     export async function handleInsights(state: Config, parsed: ParsedArgs, callOpts: ApiCallOptions): Promise<void> {
       const period = parsed.options.period || 'last-30-days';
       const format = parsed.options.format ?? 'text';
       
       // Re-use stats period date bounds calculator logic to set periodFrom / periodTo
       let periodFrom = parsed.options.from;
       let periodTo = parsed.options.to;
       if (!periodFrom && !periodTo) {
         const today = new Date();
         if (period === 'last-30-days') {
           const d = new Date();
           d.setDate(d.getDate() - 30);
           periodFrom = d.toISOString().slice(0, 10);
           periodTo = new Date().toISOString().slice(0, 10);
         } else if (period === 'this-month') {
           periodFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
           periodTo = today.toISOString().slice(0, 10);
         } else if (period === 'this-week') {
           const day = today.getDay();
           const diff = today.getDate() - day + (day === 0 ? -6 : 1);
           const monday = new Date(today.setDate(diff));
           periodFrom = monday.toISOString().slice(0, 10);
           periodTo = new Date().toISOString().slice(0, 10);
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

         const localDate = start.toLocaleDateString();
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
     ```
  3. Register case in `main()` switch routing:
     ```typescript
      case 'insights': {
        const state = await requireConfig(parsed.options.url);
        await handleInsights(state, parsed, callOpts);
        return;
      }
     ```

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm test` inside `cli` directory.
  Expected: PASS.

- [ ] **Step 5: Commit**
  Run:
  ```bash
  git add cli/src/index.ts cli/src/index.test.ts
  git commit -m "feat(cli): add insights subcommand for developer productivity telemetry"
  ```
