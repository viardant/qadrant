# Design Specification: CLI / MCP Advanced Filters & Unification

**Date:** 2026-06-18
**Status:** Draft — awaiting review
**Scope:** `cli/`, `mcp-server/`, new `shared/` package
**Depends on:** Phase 1 (`2026-06-18-enrich-read-ops-aggregations-design.md` — already implemented)

## 1. Motivation

Phase 1 added basic aggregation (group-by dimensions, preset periods). However, agents cannot answer questions like:

- "How much time did I spend in **Work** this month?" — no space filter on aggregations
- "Show me my hours for **June 1–10**" — no custom date ranges
- "Show me the individual sessions that make up my 'Work' aggregate" — no raw entries under aggregates
- "List all entries I logged in the **Piano** space" — no space filter on `list`

Additionally, Phase 1 left several implementation-level problems:

- The aggregation engine is copy-pasted between `cli/` and `mcp-server/`
- `stats` and `aggregate` CLI commands are nearly identical (Phase 1 kept both)
- `qadrant_get_stats` and `qadrant_aggregate` MCP tools are redundant

## 2. Goal & non-goals

### Goals

1. Add space/specialization **filtering** to `stats`/`list` CLI commands and MCP tools
2. Add custom date range (`--from`/`--to`) alongside existing presets
3. Add `--include-entries` flag to return raw entries alongside aggregated results
4. Merge `stats` + `aggregate` into a single `stats` CLI command
5. Merge `qadrant_get_stats` + `qadrant_aggregate` into `qadrant_get_stats` MCP tool
6. Extract shared aggregation engine into `shared/` package to eliminate duplication
7. Add space/spec/date filters to `list` / `qadrant_list_entries`

### Non-goals (YAGNI)

- Natural language date parsing (`"last 3 days"`)
- Drill-down by clicking aggregate rows (that's SPA territory)
- New KPI functions (streak, mastery, etc.)
- Periods beyond `today`/`this-week`/`this-month`/`all` (presets stay limited; arbitrary ranges cover the rest)
- Removing `qadrant_aggregate` / `aggregate` silently — keep aliases with deprecation warnings for one release cycle

## 3. CLI command surface

### 3.1 `qadrant stats` — merged and enriched

```
qadrant stats [--by <space|combo|day|week|month>]
              [--period <today|this-week|this-month|all>]
              [--from <YYYY-MM-DD>] [--to <YYYY-MM-DD>]
              [--space <name>] [--spec <name>]
              [--include-entries]
              [--format <text|json>]
```

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--by` | no | (none) | Group dimension. Omitted → single total (legacy behavior). |
| `--period` | no | `all` | Preset time window. Ignored if `--from`/`--to` provided. |
| `--from` | no | — | Start date (inclusive), `YYYY-MM-DD`. Must pair with `--to`. |
| `--to` | no | — | End date (inclusive), `YYYY-MM-DD`. Must pair with `--from`. |
| `--space` | no | — | Filter entries to this space name (exact match). |
| `--spec` | no | — | Filter entries to this specialization (exact match). |
| `--include-entries` | no | `false` | Attach raw entry objects under each group row in JSON output. |
| `--format` | no | `text` | Output format. |
| `--limit` | no | `10000` | Max entries to fetch for aggregation. |

**Behavior matrix:**

| `--by` | `--include-entries` | Output |
|--------|---------------------|--------|
| omitted | false | `TOTAL_TRACKED_HOURS: 12.34` (legacy, unchanged) |
| omitted | true | Text: total line + compact entry list below. JSON: `{ total_hours, session_count, entries: [...] }` |
| given | false | Aggregated table with KEY/HOURS/SESSIONS/SHARE |
| given | true | Table + per-group entry list; JSON embeds entries in `rows[].entries` |

**Error cases:**

| Case | Exit | Message |
|------|------|---------|
| `--from` without `--to`, or vice versa | 1 | `ERROR: --from and --to must be used together` |
| Invalid date format in `--from`/`--to` | 1 | `ERROR: --from must be YYYY-MM-DD` |
| `--from` > `--to` | 1 | `ERROR: --from must be before --to` |

### 3.2 `qadrant aggregate` — deprecated alias

```
qadrant aggregate ...
```

Aliases to `qadrant stats ...` with a deprecation warning printed to stderr:

```
Warning: 'aggregate' is deprecated. Use 'stats' instead.
```

### 3.3 `qadrant list` — expanded with filters

```
qadrant list [--space <name>] [--spec <name>]
             [--period <today|this-week|this-month|all>]
             [--from <YYYY-MM-DD>] [--to <YYYY-MM-DD>]
             [--limit <n>] [--offset <n>]
             [--format <text|json>]
```

Default `--limit` stays 10. `--format json` produces a structured payload with entries, pagination info, and stats.

When no filters are given, behavior is identical to current (most recent N completed entries).

## 4. MCP tool surface

### 4.1 `qadrant_get_stats` — unified

```typescript
{
  by?: 'space' | 'combo' | 'day' | 'week' | 'month',
  period?: 'today' | 'this-week' | 'this-month' | 'all',
  from?: string,           // YYYY-MM-DD
  to?: string,             // YYYY-MM-DD
  space?: string,
  specialization?: string,
  include_entries?: boolean,
  limit?: number,          // default 10000
  response_format?: 'markdown' | 'json'
}
```

- Omit `by` → legacy single-number behavior (backward compatible).
- `from`/`to` take precedence over `period` when both provided.
- `include_entries: true` → each `AggregateRow` in `structuredContent` includes an `entries: StructuredEntry[]` field.
- `space`/`specialization` filter server-side on the entries list used for aggregation.

**Structured content shape (JSON mode, with `include_entries: true`):**

```json
{
  "by": "space",
  "period": "june-2026",
  "window": { "start": "2026-06-01", "end": "2026-06-30" },
  "rows": [
    {
      "key": "Work",
      "hours": 12.34,
      "sessions": 8,
      "share": 0.6421,
      "entries": [
        {
          "id": "abc123",
          "space": "Work",
          "specialization": "Coding",
          "start_date": "2026-06-01T09:00:00.000Z",
          "completion_time": "2026-06-01T11:30:00.000Z",
          "duration_hours": 2.5
        }
      ]
    }
  ],
  "total": { "hours": 19.20, "sessions": 16 }
}
```

**Period naming when custom dates used:** The `period` field takes the value `"custom"` when `--from`/`--to` are used instead of a preset.

### 4.2 `qadrant_aggregate` — deprecated

Retained for one release cycle. Prints a deprecation notice in the response text and delegates to `qadrant_get_stats` internally. The description is updated to say "Deprecated: use qadrant_get_stats instead."

### 4.3 `qadrant_list_entries` — expanded

```typescript
{
  space?: string,
  specialization?: string,
  period?: 'today' | 'this-week' | 'this-month' | 'all',
  from?: string,
  to?: string,
  limit?: number,          // default 10, max 100
  offset?: number,         // default 0
  response_format?: 'markdown' | 'json'
}
```

All filters are applied server-side via the PocketBase filter string. When no filters given, behavior is identical to current.

## 5. Shared package: `shared/`

### Rationale

The aggregation engine (`aggregate.ts`) was copy-pasted between `cli/src/` and `mcp-server/src/tools/`. With this change, both need the same new filter logic (space filter, spec filter, custom date ranges, entries attachment). Keeping them in sync manually is fragile.

### Structure

```
shared/
  package.json       # private: true, no dependencies
  tsconfig.json      # ES2022, NodeNext
  src/
    aggregate.ts     # Aggregation engine (from mcp-server/src/tools/aggregate.ts)
    types.ts         # Shared types: TimeEntry, GroupBy, Period, AggregateResult, etc.
    date-helpers.ts  # getLocalDateString, getLocalMonthString, getLocalWeekMondayString, getEntryDurationHours
    filters.ts       # NEW: filterBySpace, filterBySpecialization, filterByCustomRange, buildFilter
    index.ts         # Re-exports all public API
```

### Public API

```typescript
export type { TimeEntry, GroupBy, Period, AggregateRow, AggregateResult, AggregateOptions };

export { getLocalDateString, getLocalMonthString, getLocalWeekMondayString, getEntryDurationHours };
export { windowForPeriod, filterByPeriod, filterBySpace, filterBySpecialization };
export { comboDisplayName, groupBy, aggregateBy };
export { formatAggregateText, formatAggregateJson };
```

### Import paths

- CLI: `import { ... } from '../../shared/src/index.js'` (relative path or workspace alias)
- MCP: `import { ... } from '../../shared/src/index.js'`

Both `cli/` and `mcp-server/` remove their local `aggregate.ts` and import from `shared/` instead.

### Tests

Tests move to `shared/src/aggregate.test.ts` and `shared/src/filters.test.ts`. CLI and MCP test files import from `shared/` just like production code.

## 6. Filter logic (new)

### Space filter

```typescript
function filterBySpace(entries: TimeEntry[], space: string): TimeEntry[] {
  return entries.filter(e => e.space === space);
}
```

Exact match, case-sensitive.

### Specialization filter

```typescript
function filterBySpecialization(entries: TimeEntry[], spec: string): TimeEntry[] {
  return entries.filter(e => e.specialization === spec);
}
```

Exact match, case-sensitive.

### Custom date range filter

```typescript
function filterByCustomRange(entries: TimeEntry[], from: string, to: string): TimeEntry[] {
  return entries.filter(e => {
    const d = getLocalDateString(new Date(e.start_date));
    return d >= from && d <= to;
  });
}
```

### Combined filter pipeline

The `aggregateBy` function gains additional optional options:

```typescript
interface AggregateOptions {
  by: GroupBy;
  period?: Period;
  from?: string;
  to?: string;
  space?: string;
  specialization?: string;
  includeEntries?: boolean;
}
```

Pipeline order: `filterBySpace → filterBySpecialization → filterByPeriod/filterByCustomRange → groupBy → enrich`.

### Entries attachment

When `includeEntries: true`, each `AggregateRow` gains an optional `entries: TimeEntry[]` field containing the raw entry objects that belong to that group. This is computed by re-grouping the filtered entries (not re-filtering):

```typescript
if (options.includeEntries) {
  const entryGroups = new Map<string, TimeEntry[]>();
  for (const entry of filtered) {
    const key = groupKey(entry, options.by);
    if (key !== null) {
      (entryGroups.get(key) ?? []).push(entry);
    }
  }
  for (const row of enriched) {
    row.entries = entryGroups.get(row.key) ?? [];
  }
}
```

## 7. Date range precedence

When `--from`/`--to` AND `--period` are both provided:

1. `--from`/`--to` take precedence
2. `--period` is ignored
3. The `period` field in output is set to `"custom"`
4. The `window` field reflects the actual `--from`/`--to` range

No warning is printed — `--period` is simply unused when explicit dates are given.

## 8. Architecture / file layout

```
qadrant/
  shared/                         # NEW
    package.json
    tsconfig.json
    src/
      index.ts                    # Re-exports
      aggregate.ts                # Moved from mcp-server/src/tools/aggregate.ts
      types.ts                    # Shared types
      date-helpers.ts             # Extracted date helpers
      filters.ts                  # NEW: space, spec, range filters
      aggregate.test.ts           # Moved and extended
      filters.test.ts             # NEW
  cli/
    src/
      index.ts                    # EDIT: merge aggregate into stats, add new flags
      aggregate.ts                # REMOVE (imports from shared/)
      aggregate.test.ts           # REMOVE (tests in shared/)
      index.test.ts               # EDIT: new flag tests
  mcp-server/
    src/
      index.ts                    # EDIT: merge aggregate into get_stats, update list_entries schema
      schemas.ts                  # EDIT: unified GetStatsSchema, expanded ListEntriesSchema
      types.ts                    # EDIT: add entries to AggregateRow
      constants.ts                # EDIT: adjust limits
      tools/
        stats.ts                  # EDIT: new filters, include_entries support
        entries.ts                # EDIT: space/spec/date filters
        aggregate.ts              # REMOVE (imports from shared/)
        aggregate.test.ts         # REMOVE (tests in shared/)
        aggregate-handler.ts      # EDIT: delegate to stats or add deprecation alias
```

## 9. CLI argument parsing changes

`parseArgs()` in `cli/src/index.ts` gains new recognized flags:

```typescript
const options: {
  url?: string;
  space?: string;
  sub?: string;
  spec?: string;       // NEW
  limit?: number;
  by?: string;
  period?: string;
  from?: string;       // NEW
  to?: string;          // NEW
  format?: string;
  includeEntries?: boolean;  // NEW: --include-entries flag
  offset?: number;     // NEW
} = {};
```

Parse loop gains:
```
} else if (arg === '--from' && i + 1 < args.length) {
  options.from = args[++i];
} else if (arg === '--to' && i + 1 < args.length) {
  options.to = args[++i];
} else if (arg === '--spec' && i + 1 < args.length) {
  options.spec = args[++i];
} else if (arg === '--offset' && i + 1 < args.length) {
  options.offset = parseInt(args[++i], 10);
} else if (arg === '--include-entries') {
  options.includeEntries = true;
}
```

## 10. PocketBase filter strategy

### Stats endpoint

The PocketBase filter string for `stats` becomes dynamic:

```typescript
const filters: string[] = [`user='${userId}'`, `completion_time!=""`];
if (space) filters.push(`space='${space}'`);
if (specialization) filters.push(`specialization='${specialization}'`);
if (from) filters.push(`start_date>='${from}T00:00:00'`);
if (to) filters.push(`start_date<='${to}T23:59:59'`);
const filterStr = filters.join(' && ');
```

Period presets (`today`, `this-week`, `this-month`) are applied client-side after fetch (as they use local time, which PocketBase dates are stored in UTC). This preserves the existing behavior from Phase 1.

### List entries endpoint

Same filter construction for `list`, plus the existing `sort=-start_date` and pagination params.

### Limitation

PocketBase filter supports exact string match only — no partial/contains matching for space/specialization. This is acceptable; agents and users know their exact space names.

## 11. Testing strategy

### shared/ tests (new)

- `aggregate.test.ts`: Port existing tests from both CLI and MCP copies. Add:
  - `filterBySpace` — matches exact, no partial, empty
  - `filterBySpecialization` — matches exact, no partial, empty
  - `filterByCustomRange` — inclusive on both ends, edge dates, no-match
  - `aggregateBy` with space filter — only matching entries counted
  - `aggregateBy` with `includeEntries: true` — entries attached to correct groups
  - Combined: space + period + includeEntries
- `filters.test.ts`: Unit tests for all filter functions independently

### CLI tests

- `index.test.ts`: Add tests for new flags (--from, --to, --spec, --include-entries)
- Error cases: --from without --to, invalid date format, from > to
- Deprecation warning: `qadrant aggregate` emits warning to stderr

### MCP tests

- `index.test.ts`: 
  - `qadrant_get_stats` with space filter produces correct aggregation
  - `qadrant_get_stats` with `include_entries: true` produces entries in structuredContent
  - `qadrant_get_stats` with no args still returns legacy shape (regression)
  - `qadrant_list_entries` with space filter returns only matching entries
  - `qadrant_aggregate` deprecation alias works and prints warning
  - Custom date range (from/to) produces correct window
  - from/to precedence over period

## 12. Backward compatibility

| Surface | What stays | What changes |
|---------|-----------|--------------|
| `qadrant stats` (no flags) | Prints `TOTAL_TRACKED_HOURS: X.XX` | No change |
| `qadrant stats --by X` | Prints grouped table | Also works with new filters |
| `qadrant aggregate` | Emits deprecation warning to stderr, then acts as `stats` | New behavior |
| `qadrant list` (no flags) | Lists most recent 10 entries | No change |
| `qadrant list --space X` | (wasn't possible before) | New feature |
| `qadrant_get_stats` (no `by`) | Returns legacy single-number | No change |
| `qadrant_get_stats` (with `by`) | Returns grouped shape | Also accepts new filter params |
| `qadrant_aggregate` | Delegates to `qadrant_get_stats`, prints deprecation | New behavior |
| `qadrant_list_entries` (no filters) | Lists recent entries | No change |

## 13. Acceptance checklist

- [ ] `qadrant stats --by space --space Work` shows only Work row(s)
- [ ] `qadrant stats --by space --space Work --period this-month` shows Work hours for this month
- [ ] `qadrant stats --by day --from 2026-06-01 --to 2026-06-10` shows days within that range
- [ ] `qadrant stats --by space --include-entries --format json` includes `entries[]` under each row
- [ ] `qadrant stats` (no flags) still prints `TOTAL_TRACKED_HOURS: ...`
- [ ] `qadrant aggregate --by space` emits deprecation warning + produces same output as `stats --by space`
- [ ] `qadrant list --space Work` lists only Work entries
- [ ] `qadrant list --from 2026-06-01 --to 2026-06-10` lists entries in that date range
- [ ] `qadrant_get_stats` with no `by` returns legacy shape (regression)
- [ ] `qadrant_get_stats` with `space` and `include_entries` produces entries in structuredContent
- [ ] `qadrant_list_entries` with `space` and `from`/`to` filters correctly
- [ ] `qadrant_aggregate` works but warns about deprecation
- [ ] All error cases (missing paired flag, invalid date, from > to) produce correct exit codes
- [ ] shared/ tests pass
- [ ] CLI tests pass
- [ ] MCP tests pass
- [ ] No local `aggregate.ts` copies remain in `cli/` or `mcp-server/`
