# CLI / MCP Advanced Filters & Unification — Implementation Plan

**Goal:** Add space/spec/date filters, include-entries, merge stats+aggregate, and extract shared aggregation engine.

**Architecture:** New `shared/` package at repo root holds the aggregation engine. Both CLI and MCP include `../shared/src/**/*` in tsconfig `include` with rootDir removed so shared code compiles alongside each consumer. CLI merges `aggregate` → `stats`; MCP merges `qadrant_aggregate` → `qadrant_get_stats`. Deprecation aliases keep backward compat.

**Tech Stack:** TypeScript (NodeNext), Vitest, Zod (MCP), PocketBase REST API

---

## File structure

```
shared/                             NEW
  package.json
  tsconfig.json
  src/
    index.ts                        Re-exports
    types.ts                        TimeEntry, GroupBy, Period, AggregateResult, etc.
    date-helpers.ts                 getLocalDateString, getLocalMonthString, etc.
    aggregate.ts                    groupBy, aggregateBy, formatAggregateText/Json
    aggregate.test.ts               All aggregation tests (moved from CLI + MCP copies)

cli/
  package.json                      EDIT: update bin path
  tsconfig.json                     EDIT: remove rootDir, include ../shared/src
  src/
    index.ts                        EDIT: merge aggregate→stats, new flags, import from shared
    aggregate.ts                    DELETE
    aggregate.test.ts               DELETE
    index.test.ts                   EDIT: new flag parsing tests

mcp-server/
  package.json                      EDIT: update start script
  tsconfig.json                     EDIT: remove rootDir, include ../shared/src
  src/
    index.ts                        EDIT: merge aggregate→get_stats, deprecation, update descs
    schemas.ts                      EDIT: unified GetStatsSchema, expanded ListEntriesSchema
    types.ts                        EDIT: aggregate field in StructuredTimerResult
    constants.ts                    EDIT: DEFAULT_STATS_LIMIT
    tools/
      stats.ts                      EDIT: space/spec/date filters, include_entries
      entries.ts                    EDIT: space/spec/date filters
      aggregate.ts                  DELETE
      aggregate.test.ts             DELETE
      aggregate-handler.ts          EDIT: deprecation alias delegating to getStats
    index.test.ts                   EDIT: new filter/inclusion tests, regression
```

---

### Task 1: Create the shared/ package scaffold

**Files:**
- Create: `shared/package.json`, `shared/tsconfig.json`, `shared/src/types.ts`, `shared/src/date-helpers.ts`, `shared/src/index.ts`

**Steps:**

- [ ] Create `shared/package.json`:
```json
{
  "name": "@qadrant/shared",
  "version": "1.0.0",
  "private": true,
  "type": "module"
}
```

- [ ] Create `shared/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"]
}
```

- [ ] Create `shared/src/types.ts`:
```typescript
export interface TimeEntry {
  id: string;
  space: string;
  specialization: string;
  start_date: string;
  completion_time: string | null;
  user: string;
}

export type GroupBy = 'space' | 'combo' | 'day' | 'week' | 'month';
export type Period = 'today' | 'this-week' | 'this-month' | 'all';

export interface Window {
  start: string;
  end: string;
}

export interface AggregateRow {
  key: string;
  hours: number;
  sessions: number;
  share: number;
  entries?: TimeEntry[];
}

export interface AggregateResult {
  by: GroupBy;
  period: Period | 'custom';
  window: Window | null;
  rows: AggregateRow[];
  total: { hours: number; sessions: number };
}

export interface AggregateOptions {
  by: GroupBy;
  period?: Period;
  from?: string;
  to?: string;
  space?: string;
  specialization?: string;
  includeEntries?: boolean;
}
```

- [ ] Create `shared/src/date-helpers.ts`: Port the four date helpers from `mcp-server/src/tools/aggregate.ts` (the version without user field dependency):
```typescript
import type { TimeEntry } from './types.js';

export function getLocalDateString(d: Date): string {
  if (isNaN(d.getTime())) return 'Invalid Date';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLocalMonthString(d: Date): string {
  if (isNaN(d.getTime())) return 'Invalid Date';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getLocalWeekMondayString(d: Date): string {
  if (isNaN(d.getTime())) return 'Invalid Date';
  const dayOfWeek = d.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(d);
  monday.setDate(monday.getDate() + diffToMonday);
  return getLocalDateString(monday);
}

export function getEntryDurationHours(entry: TimeEntry): number {
  if (!entry.completion_time) return 0;
  const start = new Date(entry.start_date);
  const end = new Date(entry.completion_time);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  const ms = end.getTime() - start.getTime();
  return Math.max(0, ms / (1000 * 60 * 60));
}
```

- [ ] Create `shared/src/index.ts` (minimal for now):
```typescript
export type { TimeEntry, GroupBy, Period, Window, AggregateRow, AggregateResult, AggregateOptions } from './types.js';
export { getLocalDateString, getLocalMonthString, getLocalWeekMondayString, getEntryDurationHours } from './date-helpers.js';
```

- [ ] Commit:
```bash
git add shared/
git commit -m "feat: add shared/ package scaffold with types and date helpers"
```

---

### Task 2: Port aggregation engine to shared/

**Files:**
- Create: `shared/src/aggregate.ts`
- Create: `shared/src/aggregate.test.ts`
- Modify: `shared/src/index.ts`

**Steps:**

- [ ] Create `shared/src/aggregate.ts`: Port the full engine from `mcp-server/src/tools/aggregate.ts` with these changes:
  - Import types from `./types.js` and helpers from `./date-helpers.js`
  - Add `filterByCustomRange` function
  - `aggregateBy` accepts new options: `space`, `specialization`, `from`, `to`, `includeEntries`
  - Pipeline order: space filter → specialization filter → period/custom-range filter → groupBy → enrich
  - When `includeEntries: true`, attach `entries: TimeEntry[]` to each AggregateRow
  - When `from`/`to` provided, period becomes `'custom'` and window is `{ start: from, end: to }`
  - Export: `windowForPeriod`, `filterByPeriod`, `filterByCustomRange`, `comboDisplayName`, `groupBy`, `aggregateBy`, `formatAggregateText`, `formatAggregateJson`

The full code to write: Port the entire engine from existing `cli/src/aggregate.ts` (269 lines) but adapt imports to use `./types.js` and `./date-helpers.js`. Add the `filterByCustomRange` function. Update `AggregateOptions` to include `from`, `to`, `space`, `specialization`, `includeEntries`. In `aggregateBy`, apply space/spec filters first, then period/custom-range, then includeEntries attachment. When `from`/`to` present, set `period: 'custom'` and `window: { start: from, end: to }`.

- [ ] Create `shared/src/aggregate.test.ts`: Port ALL existing tests from both `cli/src/aggregate.test.ts` (420 lines) and `mcp-server/src/tools/aggregate.test.ts` (152 lines) into a single comprehensive test file. Adapt imports to use `./date-helpers.js`, `./aggregate.js`, and `./types.js`. Add new tests:
  - `filterByCustomRange` — includes entries within range, boundary dates, no match
  - `aggregateBy` with `space` filter — only matching entries counted
  - `aggregateBy` with `specialization` filter
  - `aggregateBy` with custom date range — period is 'custom', window is correct
  - `aggregateBy` with `includeEntries: true` — entries attached to correct groups
  - Combined: space + period + includeEntries

- [ ] Update `shared/src/index.ts` to re-export aggregate functions:
```typescript
export type { TimeEntry, GroupBy, Period, Window, AggregateRow, AggregateResult, AggregateOptions } from './types.js';
export { getLocalDateString, getLocalMonthString, getLocalWeekMondayString, getEntryDurationHours } from './date-helpers.js';
export {
  windowForPeriod,
  filterByPeriod,
  filterByCustomRange,
  comboDisplayName,
  groupBy,
  aggregateBy,
  formatAggregateText,
  formatAggregateJson,
} from './aggregate.js';
```

- [ ] Run shared tests:
```bash
cd shared && npx vitest run
```
Expected: All tests pass.

- [ ] Commit:
```bash
git add shared/src/aggregate.ts shared/src/aggregate.test.ts shared/src/index.ts
git commit -m "feat: port aggregation engine to shared/ with new filter and includeEntries support"
```

---

### Task 3: Update CLI tsconfig, remove old aggregate, import from shared

**Files:**
- Modify: `cli/tsconfig.json`, `cli/package.json`
- Delete: `cli/src/aggregate.ts`, `cli/src/aggregate.test.ts`
- Modify: `cli/src/index.ts` (rewrite — imported from shared, merged aggregate→stats, new flags)
- Modify: `cli/src/index.test.ts` (add new flag tests)

**Steps:**

- [ ] Update `cli/tsconfig.json` — remove `rootDir`, add shared to include:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*", "../shared/src/**/*"]
}
```

- [ ] Update `cli/package.json` bin path from `"./dist/index.js"` to `"./dist/cli/src/index.js"` (TS infers rootDir as parent of both `src` and `../shared/src`).

- [ ] Delete old files:
```bash
rm cli/src/aggregate.ts cli/src/aggregate.test.ts
```

- [ ] Rewrite `cli/src/index.ts`: The full new CLI. Key changes:
  1. Import from `'../../shared/src/index.js'` instead of `'./aggregate.js'`
  2. `parseArgs` adds `--spec`, `--from`, `--to`, `--offset`, `--include-entries`
  3. `aggregate` command prints deprecation warning to stderr then falls through to `stats`
  4. `stats` command accepts all new flags: `--from`, `--to`, `--space`, `--spec`, `--include-entries`
  5. When `--by` given with `--include-entries`, text output shows per-group entry list after table
  6. When `--by` omitted with `--include-entries`, text shows total + compact entry list
  7. `list` command accepts `--space`, `--spec`, `--from`, `--to`, `--offset`, `--format json`
  8. Error cases: `--from` without `--to`, invalid date format, `from > to`
  9. Space/spec filters applied server-side via PocketBase filter string

- [ ] Update `cli/src/index.test.ts`: Add test cases:
  - `--from`/`--to` parsing
  - `--space`/`--spec` on stats
  - `--space`/`--spec` on list
  - `--include-entries` flag
  - `--offset` flag
  - `aggregate` command still parses (for deprecation alias)

- [ ] Run CLI tests and type-check:
```bash
cd cli && npx vitest run && npx tsc --noEmit
```
Expected: All tests pass, no type errors.

- [ ] Commit:
```bash
git add cli/
git commit -m "feat(cli): merge aggregate into stats, add --from/--to/--space/--spec/--include-entries flags, import from shared/"
```

---

### Task 4: Update MCP tsconfig, remove old aggregate, update schemas/types/constants

**Files:**
- Modify: `mcp-server/tsconfig.json`, `mcp-server/package.json`
- Delete: `mcp-server/src/tools/aggregate.ts`, `mcp-server/src/tools/aggregate.test.ts`
- Modify: `mcp-server/src/schemas.ts`, `mcp-server/src/types.ts`, `mcp-server/src/constants.ts`

**Steps:**

- [ ] Update `mcp-server/tsconfig.json` — remove rootDir, add shared to include:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*", "../shared/src/**/*"]
}
```

- [ ] Update `mcp-server/package.json` start script from `"node dist/index.js"` to `"node dist/mcp-server/src/index.js"`.

- [ ] Delete old files:
```bash
rm mcp-server/src/tools/aggregate.ts mcp-server/src/tools/aggregate.test.ts
```

- [ ] Update `mcp-server/src/schemas.ts`:
  - `ListEntriesSchema` gains: `space?`, `specialization?`, `period?`, `from?`, `to?`
  - `GetStatsSchema` gains: `from?`, `to?`, `space?`, `specialization?`, `include_entries?`, `limit?`
  - `AggregateSchema` stays for backward compat (deprecated)
  - Exports stay: `StartTimerInput`, `ListEntriesInput`, `GetStatsInput`, `AggregateInput`, `GetActiveTimerInput`, `StopTimerInput`

- [ ] Update `mcp-server/src/types.ts`: Add `aggregate` field to `StructuredTimerResult`:
```typescript
aggregate?: {
  by: string;
  period: string;
  window: { start: string; end: string } | null;
  rows: Array<{
    key: string;
    hours: number;
    sessions: number;
    share: number;
    entries?: StructuredEntry[];
  }>;
  total: { hours: number; sessions: number };
};
```

- [ ] Update `mcp-server/src/constants.ts` — add `DEFAULT_STATS_LIMIT = 10000`.

- [ ] Commit:
```bash
git add mcp-server/tsconfig.json mcp-server/package.json mcp-server/src/schemas.ts mcp-server/src/types.ts mcp-server/src/constants.ts
git rm mcp-server/src/tools/aggregate.ts mcp-server/src/tools/aggregate.test.ts
git commit -m "feat(mcp): update tsconfig, schemas, types for shared/ imports and new filters"
```

---

### Task 5: Rewrite MCP stats handler with new filters and include_entries

**Files:**
- Modify: `mcp-server/src/tools/stats.ts`

**Steps:**

- [ ] Rewrite `mcp-server/src/tools/stats.ts`:
  1. Import from `'../../../shared/src/index.js'` instead of `'./aggregate.js'`
  2. Build PocketBase filter string with optional `space`, `specialization`, `from`, `to`
  3. When `by` is provided: call `aggregateBy` with all new options (`space`, `specialization`, `from`, `to`, `includeEntries`)
  4. Build `structured.aggregate` object mirroring AggregateResult shape, with `entries` populated as `StructuredEntry[]` when `includeEntries: true`
  5. Legacy no-by path unchanged (still computes total hours from raw entries)
  6. JSON output uses `JSON.stringify(structured)` for the full envelope
  7. Text output uses `formatAggregateText(result)` for grouped, legacy string for total

- [ ] Commit:
```bash
git add mcp-server/src/tools/stats.ts
git commit -m "feat(mcp): add space/spec/date filters and include_entries to getStats handler"
```

---

### Task 6: Rewrite MCP entries handler with filters

**Files:**
- Modify: `mcp-server/src/tools/entries.ts`

**Steps:**

- [ ] Rewrite `mcp-server/src/tools/entries.ts`:
  1. Build PocketBase filter with optional `space`, `specialization`, `from`, `to`
  2. In JSON output, add `filters` object showing which filters were applied
  3. Text output unchanged (entries list format)

- [ ] Commit:
```bash
git add mcp-server/src/tools/entries.ts
git commit -m "feat(mcp): add space/spec/date filters to listEntries handler"
```

---

### Task 7: Update aggregate-handler and MCP index.ts — deprecation alias

**Files:**
- Modify: `mcp-server/src/tools/aggregate-handler.ts`
- Modify: `mcp-server/src/index.ts`

**Steps:**

- [ ] Rewrite `mcp-server/src/tools/aggregate-handler.ts`: Convert from standalone implementation to a thin deprecation wrapper that delegates to `getStats`:
```typescript
import { getStats } from './stats.js';
import type { Config, StructuredTimerResult } from '../types.js';
import type { AggregateInput, GetStatsInput } from '../schemas.js';
import { ResponseFormat } from '../types.js';

export async function qadrantAggregate(
  config: Config,
  input: AggregateInput
): Promise<{ text: string; structured: StructuredTimerResult }> {
  const statsInput: GetStatsInput = {
    by: input.by,
    period: input.period,
    response_format: input.response_format,
  };
  const result = await getStats(config, statsInput);
  return {
    text: `[Deprecated: use qadrant_get_stats instead]\n\n${result.text}`,
    structured: { ...result.structured, status: 'aggregate_computed', message: `[Deprecated] ${result.structured.message}` },
  };
}
```

- [ ] Update `mcp-server/src/index.ts`:
  1. Update `qadrant_get_stats` tool description to document all new args
  2. Update `qadrant_list_entries` tool description to document new filter args
  3. Update `qadrant_aggregate` tool description to mark as DEPRECATED
  4. All tool registrations stay — aggregate delegates to stats via the handler

- [ ] Commit:
```bash
git add mcp-server/src/tools/aggregate-handler.ts mcp-server/src/index.ts
git commit -m "feat(mcp): merge qadrant_aggregate into qadrant_get_stats, add deprecation alias"
```

---

### Task 8: Update MCP tests

**Files:**
- Modify: `mcp-server/src/index.test.ts`

**Steps:**

- [ ] Update `mcp-server/src/index.test.ts`:
  1. Keep all existing tests (config, apiCall, startTimer, stopTimer, getActiveTimer)
  2. Update `listEntries` test: add a test with space/from/to filters, verify `filters` object in JSON output
  3. Update `getStats` tests:
     - Legacy no-by path still works (regression)
     - `by` + `space` filter produces correct rows
     - `by` + `include_entries: true` produces entries array in structuredContent
     - `by` + `from`/`to` produces `period: 'custom'` and correct window
  4. Update `qadrantAggregate` test: verify deprecation warning in text output, still produces results

- [ ] Run MCP tests:
```bash
cd mcp-server && npx vitest run
```
Expected: All tests pass.

- [ ] Commit:
```bash
git add mcp-server/src/index.test.ts
git commit -m "test(mcp): add tests for filters, include_entries, and deprecation alias"
```

---

### Task 9: Final verification — all tests pass, builds compile

**Steps:**

- [ ] Run all tests:
```bash
cd shared && npx vitest run
cd ../cli && npx vitest run
cd ../mcp-server && npx vitest run
```
Expected: All three pass.

- [ ] Type-check all:
```bash
cd shared && npx tsc --noEmit
cd ../cli && npx tsc --noEmit
cd ../mcp-server && npx tsc --noEmit
```
Expected: No type errors in any package.

- [ ] Full build:
```bash
cd shared && npx tsc
cd ../cli && npx tsc
cd ../mcp-server && npx tsc
```
Expected: All compile. Verify `cli/dist/cli/src/index.js` and `mcp-server/dist/mcp-server/src/index.js` exist.

- [ ] Check no stale copies remain:
```bash
test ! -f cli/src/aggregate.ts && echo "CLI: OK" || echo "CLI: STALE"
test ! -f mcp-server/src/tools/aggregate.ts && echo "MCP: OK" || echo "MCP: STALE"
```

- [ ] Commit:
```bash
git add -A && git status
git commit -m "chore: final verification - all tests pass, builds compile, shared integration complete"
```

---

## Build order

```
shared/tsc  (type-check only — consumers compile shared source inline)
cli/tsc     (compiles cli/src/ + shared/src/)
mcp-server/tsc  (compiles mcp-server/src/ + shared/src/)
```

## Test commands

```bash
cd shared && npx vitest run      # Aggregation engine unit tests
cd cli && npx vitest run          # CLI arg parsing + flag tests
cd mcp-server && npx vitest run   # MCP tool integration tests
```
